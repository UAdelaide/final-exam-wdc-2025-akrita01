const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
const PORT = 3000;

let db;

(async () => {
  try {
    // Connect to the DogWalkService database
    db = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',   // no password as required
      database: 'DogWalkService'
    });

    // Insert test users if table empty
    const [users] = await db.execute('SELECT COUNT(*) AS count FROM Users');
    if (users[0].count === 0) {
      await db.execute(`
        INSERT INTO Users (username, email, password_hash, role) VALUES
        ('alice123', 'alice@example.com', 'hashed123', 'owner'),
        ('bobwalker', 'bob@example.com', 'hashed456', 'walker'),
        ('carol123', 'carol@example.com', 'hashed789', 'owner'),
        ('newwalker', 'newwalker@example.com', 'hashed000', 'walker')
      `);
    }

    // Insert test dogs if table empty
    const [dogs] = await db.execute('SELECT COUNT(*) AS count FROM Dogs');
    if (dogs[0].count === 0) {
      await db.execute(`
        INSERT INTO Dogs (owner_id, name, size)
        SELECT user_id, 'Max', 'medium' FROM Users WHERE username='alice123'
        UNION ALL
        SELECT user_id, 'Bella', 'small' FROM Users WHERE username='carol123'
      `);
    }

    // Insert test walk requests if empty
    const [walkreqs] = await db.execute('SELECT COUNT(*) AS count FROM WalkRequests');
    if (walkreqs[0].count === 0) {
      await db.execute(`
        INSERT INTO WalkRequests (dog_id, requested_time, duration_minutes, location, status)
        SELECT dog_id, '2025-06-10 08:00:00', 30, 'Parklands', 'open' FROM Dogs WHERE name='Max'
        UNION ALL
        SELECT dog_id, '2025-06-10 09:30:00', 45, 'Beachside Ave', 'accepted' FROM Dogs WHERE name='Bella'
      `);
    }

  } catch (err) {
    console.error('DB setup error:', err);
  }
})();

// GET /api/dogs
app.get('/api/dogs', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT d.name AS dog_name, d.size, u.username AS owner_username
      FROM Dogs d JOIN Users u ON d.owner_id = u.user_id
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get dogs' });
  }
});

// GET /api/walkrequests/open
app.get('/api/walkrequests/open', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT wr.request_id, d.name AS dog_name, wr.requested_time, wr.duration_minutes, wr.location, u.username AS owner_username
      FROM WalkRequests wr
      JOIN Dogs d ON wr.dog_id = d.dog_id
      JOIN Users u ON d.owner_id = u.user_id
      WHERE wr.status = 'open'
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get open walk requests' });
  }
});

// GET /api/walkers/summary
app.get('/api/walkers/summary', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT
        u.username AS walker_username,
        COUNT(DISTINCT wr.request_id) AS completed_walks,
        COUNT(wr.rating) AS total_ratings,
        AVG(wr.rating) AS average_rating
      FROM Users u
      LEFT JOIN WalkApplications wa ON u.user_id = wa.walker_id
      LEFT JOIN WalkRequests wrq ON wa.request_id = wrq.request_id
      LEFT JOIN WalkRatings wr ON wr.request_id = wrq.re_
