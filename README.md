# CampusOps – React + Express + MongoDB
## Run
```
# 1. server
cd server && cp .env.example .env && npm install && npm run seed && npm start   # http://localhost:5000
# 2. client (new terminal)
cd client && npm install && npm run dev                                          # http://localhost:5173
```
Seeded logins (password `password123`): admin@c.edu (Super Admin), campus@c.edu, hod@c.edu, faculty@c.edu, student@c.edu, security@c.edu, maint@c.edu, event@c.edu
## Structure
- server/index.js – schemas, JWT auth, role middleware, all module APIs
- client/src/App.jsx – login, role-based navigation, all six module screens
## Not included yet
Email/SMS/push delivery (notifications are stored in DB and shown in-app), on-duty requests, camera QR scanning (code entry is used), PDF export, tests.
