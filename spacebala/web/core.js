/* =====================================================================
 * Space Bala — CORE GAME LOGIC (pure, no DOM, no rendering)
 * ---------------------------------------------------------------------
 * This module contains ALL gameplay state and rules. It touches no
 * browser APIs, so the exact same code runs:
 *   1. In the browser / Android WebView (driven by game.js)
 *   2. Headless in Node.js for the automated crash/perf test harness
 *
 * Everything is deterministic when you pass a seeded rng, which lets the
 * test harness reproduce any failing run.
 * ===================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SpaceBalaCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---- Small, fast, seedable PRNG (mulberry32) ----------------------
  function makeRng(seed) {
    let a = (seed >>> 0) || 0x9e3779b9;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Hard safety caps so a pathological run can never exhaust memory.
  // These double as invariants the test harness asserts against.
  const MAX_ENEMIES = 400;
  const MAX_BULLETS = 200;
  const MAX_PARTICLES = 300;

  function Game(opts) {
    opts = opts || {};
    this.W = opts.width || 300;      // logical playfield width
    this.H = opts.height || 400;     // logical playfield height
    this.rng = opts.rng || makeRng(opts.seed || 12345);
    this.onGameOver = opts.onGameOver || null; // callback(msg, score)
    this.reset();
  }

  Game.prototype.reset = function () {
    this.player = { x: 20, y: this.H / 2, width: 20, height: 15, speed: 4 };
    this.bullets = [];
    this.enemies = [];
    this.particles = [];
    this.stars = [];
    this.keys = { up: false, down: false, fire: false };
    this.score = 0;
    this.level = 1;
    this.lives = 3;         // retention: not a one-hit death
    this.invuln = 0;        // i-frames after taking a hit
    this.gameOver = false;
    this.gameOverMsg = 'GAME OVER';
    this.frameCount = 0;
    this.bossActive = false;
    this.boss = null;
    this.fireCooldown = 0;
    for (let i = 0; i < 60; i++) {
      this.stars.push({
        x: this.rng() * this.W,
        y: this.rng() * this.H,
        speed: this.rng() * 2 + 1,
        size: this.rng() < 0.2 ? 2 : 1
      });
    }
  };

  Game.prototype.setInput = function (up, down, fire) {
    this.keys.up = !!up; this.keys.down = !!down; this.keys.fire = !!fire;
  };

  Game.prototype._fire = function () {
    if (this.fireCooldown > 0) return;
    if (this.bullets.length >= MAX_BULLETS) return;
    this.fireCooldown = 9; // frames between shots
    this.bullets.push({ x: this.player.x + this.player.width, y: this.player.y + this.player.height / 2 - 2, w: 10, h: 4, speed: 8 });
  };

  Game.prototype._explode = function (x, y, color) {
    color = color || '#ffffff';
    const n = 15;
    for (let i = 0; i < n; i++) {
      if (this.particles.length >= MAX_PARTICLES) break;
      this.particles.push({
        x: x, y: y,
        vx: (this.rng() - 0.5) * 6, vy: (this.rng() - 0.5) * 6,
        life: 20 + this.rng() * 10, color: color
      });
    }
  };

  Game.prototype._spawnEnemy = function () {
    if (this.bossActive) return;
    if (this.enemies.length >= MAX_ENEMIES) return;
    const r = this.rng();
    const y = this.rng() * (this.H - 20);
    const L = this.level;
    if (L === 1) {
      this.enemies.push({ x: this.W, y: y, w: 20, h: 20, speed: this.rng() * 2 + 2, hp: 1, type: 'basic', color: '#ff3355' });
    } else if (L === 2) {
      if (r < 0.3) this.enemies.push({ x: this.W, y: y, w: 15, h: 10, speed: 6, hp: 1, type: 'interceptor', color: '#ffee00' });
      else this.enemies.push({ x: this.W, y: y, w: 20, h: 20, speed: this.rng() * 2 + 2, hp: 1, type: 'basic', color: '#ff3355' });
    } else if (L === 3) {
      if (r < 0.2) this.enemies.push({ x: this.W, y: y, w: 30, h: 30, speed: 1.5, hp: 5, type: 'asteroid', color: '#888888' });
      else if (r < 0.5) this.enemies.push({ x: this.W, y: y, w: 15, h: 10, speed: 6, hp: 1, type: 'interceptor', color: '#ffee00' });
      else this.enemies.push({ x: this.W, y: y, w: 20, h: 20, speed: this.rng() * 2 + 2, hp: 1, type: 'basic', color: '#ff3355' });
    } else {
      if (r < 0.3) this.enemies.push({ x: this.W, y: y, w: 25, h: 15, speed: 3, hp: 2, type: 'wave', color: '#ff33ff', startY: y });
      else if (r < 0.5) this.enemies.push({ x: this.W, y: y, w: 30, h: 30, speed: 1.5, hp: 5, type: 'asteroid', color: '#888888' });
      else this.enemies.push({ x: this.W, y: y, w: 15, h: 10, speed: 6, hp: 1, type: 'interceptor', color: '#ffee00' });
    }
  };

  Game.prototype._updateLevel = function () {
    if (this.score < 100) this.level = 1;
    else if (this.score < 300) this.level = 2;
    else if (this.score < 600) this.level = 3;
    else if (this.score < 1000) this.level = 4;
    else if (this.score >= 1000 && !this.bossActive && !this.boss) {
      this.level = 5;
      this.bossActive = true;
      this.enemies = [];
      this.boss = { x: this.W + 50, y: this.H / 2 - 40, w: 60, h: 80, hp: 100, maxHp: 100 };
    }
  };

  Game.prototype._updateBoss = function () {
    const boss = this.boss;
    if (!boss) return;
    if (boss.x > this.W - 80) { boss.x -= 1; return; }
    boss.y += Math.sin(this.frameCount * 0.05) * 2;
    if (boss.y < 0) boss.y = 0;
    if (boss.y > this.H - boss.h) boss.y = this.H - boss.h;
    if (this.frameCount % 40 === 0 && this.enemies.length < MAX_ENEMIES) {
      this.enemies.push({ x: boss.x, y: boss.y + 10, w: 15, h: 5, speed: 6, hp: 1, type: 'boss_laser', color: '#ff33ff', vx: -6, vy: -1 });
      this.enemies.push({ x: boss.x, y: boss.y + boss.h - 15, w: 15, h: 5, speed: 6, hp: 1, type: 'boss_laser', color: '#ff33ff', vx: -6, vy: 1 });
      this.enemies.push({ x: boss.x, y: boss.y + boss.h / 2, w: 15, h: 5, speed: 6, hp: 1, type: 'boss_laser', color: '#ff33ff', vx: -6, vy: 0 });
    }
  };

  Game.prototype._end = function (msg) {
    if (this.gameOver) return;
    this.gameOver = true;
    this.gameOverMsg = msg || 'GAME OVER';
    if (this.onGameOver) this.onGameOver(this.gameOverMsg, this.score);
  };

  // Advance the simulation exactly one fixed step. Returns false if the
  // game is over. Never throws on valid state.
  Game.prototype.step = function () {
    if (this.gameOver) return false;
    this.frameCount++;
    if (this.fireCooldown > 0) this.fireCooldown--;
    if (this.invuln > 0) this.invuln--;
    this._updateLevel();

    const p = this.player;
    if (this.keys.up && p.y > 0) p.y -= p.speed;
    if (this.keys.down && p.y < this.H - p.height) p.y += p.speed;
    if (this.keys.fire) this._fire();

    // Bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      this.bullets[i].x += this.bullets[i].speed;
      if (this.bullets[i].x > this.W) this.bullets.splice(i, 1);
    }

    if (this.bossActive) this._updateBoss();
    else if (this.frameCount % Math.max(10, 40 - this.level * 5) === 0) this._spawnEnemy();

    // Enemies move + player collision
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.type === 'wave') e.y = e.startY + Math.sin(this.frameCount * 0.1) * 30;
      else if (e.type === 'boss_laser') { e.x += e.vx; e.y += e.vy; }
      else e.x -= e.speed;

      if (this.invuln <= 0 &&
          p.x < e.x + e.w && p.x + p.width > e.x &&
          p.y < e.y + e.h && p.y + p.height > e.y) {
        this._explode(p.x + p.width / 2, p.y + p.height / 2, '#ffcc00');
        this.lives--;
        if (this.lives <= 0) { this._end('GAME OVER'); return false; }
        this.invuln = 90;        // ~1.5s of i-frames
        this.enemies = [];       // clear the field so the respawn is fair
        break;
      }
      if (e.x + e.w < 0) { this.enemies.splice(i, 1); }
    }

    // Boss hit by bullets
    if (this.bossActive && this.boss) {
      const boss = this.boss;
      for (let j = this.bullets.length - 1; j >= 0; j--) {
        const b = this.bullets[j];
        if (b.x < boss.x + boss.w && b.x + b.w > boss.x &&
            b.y < boss.y + boss.h && b.y + b.h > boss.y) {
          this._explode(b.x, b.y, '#ff33ff');
          this.bullets.splice(j, 1);
          boss.hp--;
          this.score += 5;
          if (boss.hp <= 0) {
            this._explode(boss.x + 30, boss.y + 40, '#ffffff');
            this.bossActive = false; this.boss = null;
            this.score += 5000;
            this._end('VICTORY!');
            return false;
          }
          break;
        }
      }
    }

    // Enemies hit by bullets
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      let killed = false;
      for (let j = this.bullets.length - 1; j >= 0; j--) {
        const b = this.bullets[j];
        if (b.x < e.x + e.w && b.x + b.w > e.x &&
            b.y < e.y + e.h && b.y + b.h > e.y) {
          this.bullets.splice(j, 1);
          e.hp--;
          if (e.hp <= 0) {
            this._explode(e.x + e.w / 2, e.y + e.h / 2, e.color);
            killed = true;
            this.score += (e.type === 'asteroid') ? 50 : 10;
          } else {
            this._explode(b.x, b.y, '#ffffff');
          }
          break;
        }
      }
      if (killed) this.enemies.splice(i, 1);
    }

    // Particles + stars
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx; pt.y += pt.vy; pt.life--;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }
    const parallax = this.level * 0.5 + 0.5;
    for (let s = 0; s < this.stars.length; s++) {
      const st = this.stars[s];
      st.x -= st.speed * parallax;
      if (st.x < 0) { st.x = this.W; st.y = this.rng() * this.H; }
    }
    return true;
  };

  Game.LIMITS = { MAX_ENEMIES: MAX_ENEMIES, MAX_BULLETS: MAX_BULLETS, MAX_PARTICLES: MAX_PARTICLES };
  Game.makeRng = makeRng;
  return Game;
});
