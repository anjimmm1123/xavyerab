const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const rateLimiter = require('express-rate-limit');
const compression = require('compression');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

app.use(compression({
    level: 5,
    threshold: 0,
    filter: (req, res) => {
        if (req.headers['x-no-compression']) {
            return false;
        }
        return compression.filter(req, res);
    }
}));
app.set('view engine', 'ejs');
app.set('trust proxy', 1);
app.use(function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header(
        'Access-Control-Allow-Headers',
        'Origin, X-Requested-With, Content-Type, Accept',
    );
    console.log(`[${new Date().toLocaleString()}] ${req.method} ${req.url} - ${res.statusCode}`);
    next();
});
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(rateLimiter({ windowMs: 15 * 60 * 1000, max: 100, headers: true }));

// Serve static files
app.use(express.static('public'));
app.set('views', path.join(__dirname, 'public/html'));

// Root route - redirect to dashboard
app.get('/', function (req, res) {
    res.redirect('/dashboard');
});

// Dashboard route
app.get('/dashboard', (req, res) => {
    res.render('html/dashboard');
});

// Login endpoint
app.post('/player/growid/login', async (req, res) => {
    try {
        const { growid, password } = req.body;

        if (!growid || !password) {
            return res.status(400).json({ error: 'GrowID dan Password harus diisi' });
        }

        const dbPath = path.join(__dirname, 'database', 'players.json');
        if (!fs.existsSync(dbPath)) {
            return res.status(400).json({ error: 'Akun tidak ditemukan' });
        }

        const players = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        const player = players.find(p => p.growId.toLowerCase() === growid.toLowerCase());

        if (!player) {
            return res.status(400).json({ error: 'GrowID tidak ditemukan' });
        }

        const validPassword = await bcrypt.compare(password, player.password);
        if (!validPassword) {
            return res.status(400).json({ error: 'Password salah' });
        }

        // Login berhasil - kirim data player
        res.json({ 
            success: true, 
            message: 'Login berhasil',
            player: {
                growId: player.growId,
                level: player.level,
                gems: player.gems,
                xp: player.xp
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan saat login' });
    }
});

// Register endpoint
app.post('/player/growid/register', async (req, res) => {
    try {
        const { growid, password } = req.body;

        if (!growid || !password) {
            return res.status(400).json({ error: 'GrowID dan Password harus diisi' });
        }

        if (growid.length < 4) {
            return res.status(400).json({ error: 'GrowID minimal 4 karakter' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password minimal 6 karakter' });
        }

        const dbDir = path.join(__dirname, 'database');
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir);
        }

        const dbPath = path.join(dbDir, 'players.json');
        let players = [];
        if (fs.existsSync(dbPath)) {
            players = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        }

        const existingPlayer = players.find(p => p.growId.toLowerCase() === growid.toLowerCase());
        if (existingPlayer) {
            return res.status(400).json({ error: 'GrowID sudah digunakan' });
        }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const newPlayer = {
            growId: growid,
            password: hashedPassword,
            inventory: [],
            gems: 0,
            level: 1,
            xp: 0,
            createdAt: new Date().toISOString()
        };

        players.push(newPlayer);
        fs.writeFileSync(dbPath, JSON.stringify(players, null, 2));

        res.json({ 
            success: true, 
            message: 'Registrasi berhasil! Silakan login.'
        });

    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan saat registrasi' });
    }
});

// Game dashboard route (setelah login)
app.get('/game', (req, res) => {
    res.render(__dirname + '/public/html/game.ejs');
});

app.all('/player/*', function (req, res) {
    res.status(301).redirect('https://api.yoruakio.tech/player/' + req.path.slice(8));
});

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server berjalan di port ${port}`);
});
