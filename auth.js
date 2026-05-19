const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const usersRepo = require('./db/users');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later.' },
});

function configurePassport() {
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await usersRepo.findUserById(id);
      done(null, user || null);
    } catch (e) {
      done(e);
    }
  });

  passport.use(
    new LocalStrategy(
      { usernameField: 'email', passwordField: 'password' },
      async (email, password, done) => {
        try {
          const user = await usersRepo.findUserByEmail(email);
          if (!user || !user.password_hash) {
            return done(null, false, { message: 'Invalid email or password' });
          }
          const ok = await bcrypt.compare(password, user.password_hash);
          if (!ok) return done(null, false, { message: 'Invalid email or password' });
          return done(null, user);
        } catch (e) {
          return done(e);
        }
      }
    )
  );

  const googleConfigured =
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET;

  if (googleConfigured) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL:
            process.env.GOOGLE_CALLBACK_URL ||
            'http://localhost:3000/api/auth/google/callback',
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const googleId = profile.id;
            const emailRaw =
              profile.emails?.[0]?.value != null ? String(profile.emails[0].value) : '';
            const email = emailRaw.trim().toLowerCase();
            if (!email) {
              return done(new Error('Google did not provide an email address'));
            }

            let user = await usersRepo.findUserByGoogleId(googleId);
            if (user) return done(null, user);

            user = await usersRepo.findUserByEmail(email);
            if (user) {
              await usersRepo.linkGoogleToUser(user.id, googleId, {
                name: profile.displayName || null,
                avatarUrl: profile.photos?.[0]?.value || null,
              });
              const updated = await usersRepo.findUserById(user.id);
              return done(null, updated);
            }

            user = await usersRepo.createUser({
              email,
              googleId,
              name: profile.displayName || null,
              avatarUrl: profile.photos?.[0]?.value || null,
            });
            return done(null, user);
          } catch (e) {
            return done(e);
          }
        }
      )
    );
  }
}

/**
 * Register auth-related HTTP routes on `app`.
 * @param {import('express').Express} app
 * @param {{ doubleCsrfProtection: import('express').RequestHandler }} opts
 */
function registerAuthRoutes(app, { doubleCsrfProtection }) {
  app.get('/api/auth/me', (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    return res.json(usersRepo.toPublicUser(req.user));
  });

  app.get('/api/auth/google', (req, res, next) => {
    if (
      !process.env.GOOGLE_CLIENT_ID ||
      !process.env.GOOGLE_CLIENT_SECRET
    ) {
      return res.redirect('/?auth=oauth_unconfigured');
    }
    return passport.authenticate('google', {
      scope: ['profile', 'email'],
    })(req, res, next);
  });

  app.get(
    '/api/auth/google/callback',
    passport.authenticate('google', {
      failureRedirect: '/?auth=error',
    }),
    (req, res) => res.redirect('/?auth=success')
  );

  app.post(
    '/api/auth/signup',
    authLimiter,
    doubleCsrfProtection,
    async (req, res, next) => {
      try {
        const email = String(req.body?.email || '').trim().toLowerCase();
        const password = String(req.body?.password || '');

        if (!email || !password) {
          return res.status(400).json({ error: 'Email and password required' });
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return res.status(400).json({ error: 'Invalid email address' });
        }
        if (password.length < 8) {
          return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }

        const existing = await usersRepo.findUserByEmail(email);
        if (existing) {
          return res.status(400).json({ error: 'User already exists' });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const user = await usersRepo.createUser({ email, passwordHash });

        req.login(user, (err) => {
          if (err) return next(err);
          return res.status(201).json({
            success: true,
            user: usersRepo.toPublicUser(user),
          });
        });
      } catch (e) {
        if (e?.code === 'SQLITE_CONSTRAINT' || String(e.message || '').includes('UNIQUE')) {
          return res.status(400).json({ error: 'User already exists' });
        }
        return next(e);
      }
    }
  );

  app.post('/api/auth/login', authLimiter, doubleCsrfProtection, (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({
          error: (info && info.message) || 'Invalid email or password',
        });
      }
      req.login(user, (loginErr) => {
        if (loginErr) return next(loginErr);
        return res.json({
          success: true,
          user: usersRepo.toPublicUser(req.user),
        });
      });
    })(req, res, next);
  });

  app.post('/api/auth/logout', authLimiter, doubleCsrfProtection, (req, res, next) => {
    const sessionName = 'studyplan.sid';
    req.logout((logoutErr) => {
      if (logoutErr) return next(logoutErr);
      req.session.destroy((destroyErr) => {
        if (destroyErr) return next(destroyErr);
        res.clearCookie(sessionName, { path: '/' });
        res.json({ success: true });
      });
    });
  });
}

module.exports = {
  authLimiter,
  configurePassport,
  passport,
  registerAuthRoutes,
};
