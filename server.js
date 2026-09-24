const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const cors = require('cors');

const app = express();
const db = new Database('events.db');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database setup
db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    capacity INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    student_id TEXT NOT NULL,
    registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(event_id) REFERENCES events(id),
    UNIQUE(event_id, student_id)
  );
`);

// 1. Get all events with live seat counts
app.get('/api/events', (req, res) => {
  const query = `
    SELECT 
      e.*, 
      COUNT(r.id) AS registered_count,
      (e.capacity - COUNT(r.id)) AS seats_left
    FROM events e
    LEFT JOIN registrations r ON e.id = r.event_id
    GROUP BY e.id
    ORDER BY e.date ASC, e.start_time ASC
  `;
  const events = db.prepare(query).all();
  res.json(events);
});

// 2. Create Event (Admin)
app.post('/api/events', (req, res) => {
  const { name, date, start_time, end_time, capacity } = req.body;

  if (!name || !date || !start_time || !end_time || !capacity) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  if (start_time >= end_time) {
    return res.status(400).json({ error: 'End time must be later than start time.' });
  }

  if (Number(capacity) <= 0) {
    return res.status(400).json({ error: 'Capacity must be at least 1.' });
  }

  const stmt = db.prepare(
    `INSERT INTO events (name, date, start_time, end_time, capacity) VALUES (?, ?, ?, ?, ?)`
  );
  const info = stmt.run(name, date, start_time, end_time, Number(capacity));
  res.status(201).json({ id: info.lastInsertRowid, message: 'Event created successfully.' });
});

// 3. Register Student for an Event
app.post('/api/register', (req, res) => {
  const { event_id, student_id } = req.body;

  if (!event_id || !student_id) {
    return res.status(400).json({ error: 'student_id and event_id are required.' });
  }

  const trimmedStudentId = student_id.trim();

  const registerTx = db.transaction(() => {
    const targetEvent = db.prepare('SELECT * FROM events WHERE id = ?').get(event_id);
    if (!targetEvent) {
      throw new Error('Event not found.');
    }

    const alreadyRegistered = db.prepare(
      'SELECT id FROM registrations WHERE event_id = ? AND student_id = ?'
    ).get(event_id, trimmedStudentId);
    if (alreadyRegistered) {
      throw new Error('You are already registered for this event.');
    }

    const regCount = db.prepare(
      'SELECT COUNT(*) as count FROM registrations WHERE event_id = ?'
    ).get(event_id).count;
    if (regCount >= targetEvent.capacity) {
      throw new Error('Event is already at full capacity.');
    }

    // Overlap rule: A.start < B.end AND B.start < A.end on same date
    const overlapQuery = `
      SELECT e.name, e.start_time, e.end_time 
      FROM registrations r
      JOIN events e ON r.event_id = e.id
      WHERE r.student_id = ? 
        AND e.date = ?
        AND (? < e.end_time AND e.start_time < ?)
    `;
    const conflict = db.prepare(overlapQuery).get(
      trimmedStudentId,
      targetEvent.date,
      targetEvent.start_time,
      targetEvent.end_time
    );

    if (conflict) {
      throw new Error(
        `Schedule clash with "${conflict.name}" (${conflict.start_time} - ${conflict.end_time}).`
      );
    }

    db.prepare('INSERT INTO registrations (event_id, student_id) VALUES (?, ?)').run(
      event_id,
      trimmedStudentId
    );
  });

  try {
    registerTx();
    res.json({ success: true, message: 'Registration confirmed!' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));