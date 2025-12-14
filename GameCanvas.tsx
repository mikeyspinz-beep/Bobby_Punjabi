import React, { useRef, useEffect, useState, useCallback } from 'react';
import { 
  CANVAS_WIDTH, 
  CANVAS_HEIGHT, 
  GROUND_HEIGHT,
  COLORS, 
  GAME_CONFIG, 
  ASSETS,
  CHARACTERS
} from '../constants';
import { 
  GameState, 
  Player, 
  Enemy, 
  Bullet, 
  Particle, 
  Powerup, 
  PowerupType, 
  FloatingText,
  Point
} from '../types';

// --- UTILS ---
const dist = (p1: Point, p2: Point) => Math.hypot(p1.x - p2.x, p1.y - p2.y);
const rand = (min: number, max: number) => Math.random() * (max - min) + min;
const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));
const checkCircleCollision = (c1: { pos: Point; radius: number }, c2: { pos: Point; radius: number }) => {
  return dist(c1.pos, c2.pos) < c1.radius + c2.radius;
};

// --- ASSET LOADER ---
const images: Record<string, HTMLImageElement> = {};
const loadImages = () => {
  Object.entries(ASSETS).forEach(([key, url]) => {
    if (url) {
      if (key === 'MUSIC') return;
      if (images[key]) return; // Prevent reloading if exists
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.src = url;
      images[key] = img;
    }
  });
};

export const GameCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const requestRef = useRef<number>(); // Track animation frame ID
  
  // --- STATE REFS ---
  const gameStateRef = useRef<GameState>(GameState.MENU);
  
  const playerRef = useRef<Player & { recoil: number, muzzleFlash: number }>({
    id: 'player',
    pos: { x: 150, y: CANVAS_HEIGHT / 2 },
    radius: 55, // Slightly bigger
    rotation: 0,
    hp: GAME_CONFIG.PLAYER_MAX_HP,
    maxHp: GAME_CONFIG.PLAYER_MAX_HP,
    score: 0,
    velocity: { x: 0, y: 0 },
    fireCooldown: 0,
    powerupTime: 0,
    activePowerup: null,
    animFrame: 0,
    recoil: 0,
    muzzleFlash: 0,
    characterId: 'default'
  });
  
  const enemiesRef = useRef<Enemy[]>([]);
  const bulletsRef = useRef<Bullet[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const powerupsRef = useRef<Powerup[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  
  // Input
  const keysRef = useRef<Record<string, boolean>>({});
  const mouseRef = useRef<Point>({ x: 0, y: 0 });
  const mousePressedRef = useRef<boolean>(false);

  // Mobile Touch Input State
  const touchState = useRef({
    leftId: null as number | null,
    leftOrigin: {x: 0, y: 0},
    leftCurrent: {x: 0, y: 0},
    rightId: null as number | null,
    rightOrigin: {x: 0, y: 0},
    rightCurrent: {x: 0, y: 0},
  });

  // System
  const frameRef = useRef<number>(0);
  const waveRef = useRef<number>(1);
  const waveTimerRef = useRef<number>(0);
  const enemiesToSpawnRef = useRef<number>(0);
  const spawnTimerRef = useRef<number>(0);
  const screenShakeRef = useRef<number>(0);
  const bgOffsetRef = useRef<number>(0); 
  const bossActiveRef = useRef<boolean>(false);

  // Background Elements
  const cloudsRef = useRef<{x: number, y: number, scale: number, speed: number}[]>([]);
  const menuStarsRef = useRef<{x: number, y: number, speed: number, size: number}[]>([]);

  // UI Sync
  const [uiState, setUiState] = useState({
    gameState: GameState.MENU,
    score: 0,
    hp: 100,
    maxHp: 100,
    wave: 1,
    powerup: null as PowerupType | null,
    bossHp: 0,
    bossMaxHp: 0,
    bossName: ''
  });
  
  // Joystick UI State (for React rendering)
  const [joysticks, setJoysticks] = useState({
    left: null as {x:number, y:number, dx:number, dy:number} | null,
    right: null as {x:number, y:number, dx:number, dy:number} | null,
  });

  const [isMuted, setIsMuted] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [warningText, setWarningText] = useState("EVIL CAMEL DETECTED");

  // --- CHARACTER SELECT STATE ---
  const [unlockedCharacters, setUnlockedCharacters] = useState<string[]>(() => {
    try {
        const saved = localStorage.getItem('unlockedChars');
        return saved ? JSON.parse(saved) : ['default'];
    } catch {
        return ['default'];
    }
  });
  const [selectedCharacter, setSelectedCharacter] = useState<string>('default');

  // --- CHEAT CODE STATE ---
  const [showCheatBox, setShowCheatBox] = useState(false);
  const [cheatTimer, setCheatTimer] = useState(10);
  const cheatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cheatInputRef = useRef<string[]>([]);
  const [exploded, setExploded] = useState(false);

  const CHEAT_SEQUENCE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight'];

  // --- INIT ---
  useEffect(() => {
    // Init Clouds for game
    for(let i=0; i<8; i++) {
      cloudsRef.current.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * (CANVAS_HEIGHT * 0.4),
        scale: 0.5 + Math.random() * 0.5,
        speed: 0.2 + Math.random() * 0.3
      });
    }

    // Init Stars for menu
    for(let i=0; i<100; i++) {
      menuStarsRef.current.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT,
        speed: 0.5 + Math.random() * 3,
        size: Math.random() * 2
      });
    }
  }, []);

  // --- HELPERS ---
  const spawnParticle = (pos: Point, color: string, count: number, speed: number, size: number = 3) => {
    for (let i = 0; i < count; i++) {
      const angle = rand(0, Math.PI * 2);
      const vel = rand(1, speed);
      particlesRef.current.push({
        id: Math.random().toString(),
        pos: { ...pos },
        radius: rand(1, size),
        rotation: rand(0, Math.PI * 2),
        velocity: { x: Math.cos(angle) * vel, y: Math.sin(angle) * vel },
        lifeTime: rand(20, 50),
        maxLife: 50,
        color: color,
        size: size,
        animFrame: 0
      });
    }
  };

  const spawnFloatingText = (pos: Point, text: string, color: string) => {
    floatingTextsRef.current.push({
      id: Math.random().toString(),
      pos: { x: pos.x, y: pos.y - 30 },
      text,
      color,
      lifeTime: 50,
      velocity: { x: 0, y: -0.8 }
    });
  };

  const spawnPowerup = (pos: Point) => {
    if (Math.random() > GAME_CONFIG.POWERUP_DROP_CHANCE) return;
    const types = [PowerupType.HEAL, PowerupType.RAPID_FIRE, PowerupType.TRIPLE_SHOT];
    const type = types[Math.floor(Math.random() * types.length)];
    powerupsRef.current.push({
      id: Math.random().toString(),
      pos: { ...pos },
      radius: 25,
      rotation: 0,
      type,
      lifeTime: 600,
      animFrame: 0
    });
  };

  const unlockCharacter = (charId: string) => {
      if (!unlockedCharacters.includes(charId)) {
          const newUnlocked = [...unlockedCharacters, charId];
          setUnlockedCharacters(newUnlocked);
          localStorage.setItem('unlockedChars', JSON.stringify(newUnlocked));
          return true;
      }
      return false;
  };

  const unlockAllCharacters = useCallback(() => {
      const allChars = Object.keys(CHARACTERS);
      setUnlockedCharacters(allChars);
      localStorage.setItem('unlockedChars', JSON.stringify(allChars));
      spawnFloatingText({x: CANVAS_WIDTH/2, y: CANVAS_HEIGHT/2}, "ALL CHARACTERS UNLOCKED!", "#00ff00");
  }, []);

  const spawnBoss = () => {
    bossActiveRef.current = true;
    
    // Cycle: Camel -> 2PAC -> Biggie -> Post -> Slim -> Wayne
    const bossList: Array<'camel' | '2pac' | 'biggie' | 'postmalone' | 'slimshady' | 'lilwayne'> = 
      ['camel', '2pac', 'biggie', 'postmalone', 'slimshady', 'lilwayne'];
    
    const bossCount = Math.floor(waveRef.current / 3) - 1; 
    const bossIndex = bossCount % bossList.length;
    const bossType = bossList[bossIndex];
    
    let bossName = "EVIL CAMEL";
    if (bossType === '2pac') bossName = "2PAC";
    if (bossType === 'biggie') bossName = "BIGGIE";
    if (bossType === 'postmalone') bossName = "POST MALONE";
    if (bossType === 'slimshady') bossName = "SLIM SHADY";
    if (bossType === 'lilwayne') bossName = "LIL WAYNE";

    setWarningText(`${bossName} DETECTED`);
    
    setShowWarning(true);
    setTimeout(() => setShowWarning(false), 3000);

    setTimeout(() => {
      if (gameStateRef.current !== GameState.PLAYING) return;
      
      const hp = 600 + (waveRef.current * 150);
      enemiesRef.current.push({
        id: 'BOSS',
        pos: { x: CANVAS_WIDTH + 150, y: CANVAS_HEIGHT / 2 },
        radius: 130, 
        hp,
        maxHp: hp,
        speed: 2,
        type: 'boss',
        bossVariant: bossType,
        value: 5000,
        rotation: 0,
        animFrame: 0,
        hitFlashTimer: 0,
        attackCooldown: 120 
      });
      screenShakeRef.current = 25;
    }, 2000);
  };

  const syncUI = useCallback(() => {
    const boss = enemiesRef.current.find(e => e.type === 'boss');
    let bossName = '';
    if (boss) {
        if (boss.bossVariant === '2pac') bossName = "2PAC";
        else if (boss.bossVariant === 'biggie') bossName = "BIGGIE";
        else if (boss.bossVariant === 'postmalone') bossName = "POST MALONE";
        else if (boss.bossVariant === 'slimshady') bossName = "SLIM SHADY";
        else if (boss.bossVariant === 'lilwayne') bossName = "LIL WAYNE";
        else bossName = "EVIL CAMEL";
    }

    setUiState({
      gameState: gameStateRef.current,
      score: playerRef.current.score,
      hp: playerRef.current.hp,
      maxHp: playerRef.current.maxHp,
      wave: waveRef.current,
      powerup: playerRef.current.activePowerup,
      bossHp: boss ? boss.hp : 0,
      bossMaxHp: boss ? boss.maxHp : 1,
      bossName: bossName
    });

    // Sync Joystick State for rendering
    setJoysticks({
        left: touchState.current.leftId !== null ? { 
            x: touchState.current.leftOrigin.x, 
            y: touchState.current.leftOrigin.y,
            dx: touchState.current.leftCurrent.x - touchState.current.leftOrigin.x,
            dy: touchState.current.leftCurrent.y - touchState.current.leftOrigin.y
        } : null,
        right: touchState.current.rightId !== null ? {
            x: touchState.current.rightOrigin.x, 
            y: touchState.current.rightOrigin.y,
            dx: touchState.current.rightCurrent.x - touchState.current.rightOrigin.x,
            dy: touchState.current.rightCurrent.y - touchState.current.rightOrigin.y
        } : null
    });
  }, []);

  // --- CHEAT LOGIC ---
  const activateCheatBox = useCallback(() => {
      setShowCheatBox(true);
      setCheatTimer(10);
      setExploded(false);
      cheatInputRef.current = [];
      
      if (cheatTimerRef.current) clearInterval(cheatTimerRef.current);
      cheatTimerRef.current = setInterval(() => {
          setCheatTimer(prev => {
              if (prev <= 1) {
                  // Boom - Reset Game
                  if (cheatTimerRef.current) clearInterval(cheatTimerRef.current);
                  setExploded(true);
                  screenShakeRef.current = 50; 
                  
                  setTimeout(() => {
                      setShowCheatBox(false);
                      // RESET TO MENU
                      gameStateRef.current = GameState.MENU;
                      syncUI();
                  }, 1000);
                  
                  return 0;
              }
              return prev - 1;
          });
      }, 1000);
  }, [syncUI]);

  const handleCheatInput = useCallback((key: string) => {
      if (!showCheatBox || exploded) return;
      
      cheatInputRef.current.push(key);
      // Keep only last N inputs
      if (cheatInputRef.current.length > CHEAT_SEQUENCE.length) {
          cheatInputRef.current.shift();
      }

      // Check Match
      if (JSON.stringify(cheatInputRef.current) === JSON.stringify(CHEAT_SEQUENCE)) {
          // Success
          if (cheatTimerRef.current) clearInterval(cheatTimerRef.current);
          unlockAllCharacters();
          setShowCheatBox(false);
      }
  }, [showCheatBox, exploded, unlockAllCharacters]);

  // --- LOGIC LOOP ---
  const goToCharacterSelect = () => {
    gameStateRef.current = GameState.CHARACTER_SELECT;
    syncUI();
  };

  const startGame = () => {
    playerRef.current = {
      ...playerRef.current,
      pos: { x: 150, y: CANVAS_HEIGHT - GROUND_HEIGHT - 30 },
      radius: 55,
      hp: GAME_CONFIG.PLAYER_MAX_HP,
      score: 0,
      activePowerup: null,
      powerupTime: 0,
      animFrame: 0,
      recoil: 0,
      muzzleFlash: 0,
      characterId: selectedCharacter
    };
    
    enemiesRef.current = [];
    bulletsRef.current = [];
    particlesRef.current = [];
    powerupsRef.current = [];
    floatingTextsRef.current = [];
    
    screenShakeRef.current = 0;
    waveRef.current = 1;
    waveTimerRef.current = 0;
    enemiesToSpawnRef.current = 5;
    spawnTimerRef.current = 0;
    bossActiveRef.current = false;
    
    gameStateRef.current = GameState.PLAYING;
    syncUI();

    if (musicRef.current) {
      musicRef.current.currentTime = 0;
      musicRef.current.volume = 0.4;
      musicRef.current.play().catch(e => console.error("Music play failed:", e));
    }
  };

  const update = () => {
    frameRef.current++;
    
    // Background Update
    bgOffsetRef.current = (bgOffsetRef.current + 5) % CANVAS_WIDTH; // Speed 5
    cloudsRef.current.forEach(c => {
      c.x -= c.speed;
      if (c.x < -200) c.x = CANVAS_WIDTH + 200;
    });

    // Update Stars
    menuStarsRef.current.forEach(star => {
        star.x -= star.speed;
        if (star.x < 0) {
            star.x = CANVAS_WIDTH;
            star.y = Math.random() * CANVAS_HEIGHT;
        }
    });

    if (gameStateRef.current !== GameState.PLAYING) return;

    const player = playerRef.current;
    
    // 1. Player Movement
    let dx = 0; 
    let dy = 0;
    
    // Keyboard Input
    if (keysRef.current['w'] || keysRef.current['arrowup']) dy -= 1;
    if (keysRef.current['s'] || keysRef.current['arrowdown']) dy += 1;
    if (keysRef.current['a'] || keysRef.current['arrowleft']) dx -= 1;
    if (keysRef.current['d'] || keysRef.current['arrowright']) dx += 1;

    // Mobile Joystick Input
    if (touchState.current.leftId !== null) {
        const deltaX = touchState.current.leftCurrent.x - touchState.current.leftOrigin.x;
        const deltaY = touchState.current.leftCurrent.y - touchState.current.leftOrigin.y;
        const dist = Math.hypot(deltaX, deltaY);
        const maxDist = 40; 
        if (dist > 5) {
             const strength = Math.min(dist, maxDist) / maxDist;
             dx = (deltaX / dist) * strength;
             dy = (deltaY / dist) * strength;
        } else {
             dx = 0; dy = 0;
        }
    } else if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy);
      dx /= len; dy /= len;
    }
    
    const nextX = player.pos.x + dx * GAME_CONFIG.PLAYER_SPEED;
    const nextY = player.pos.y + dy * GAME_CONFIG.PLAYER_SPEED;
    
    // Constraints
    const HORIZON_Y = CANVAS_HEIGHT * 0.45; 
    const MAX_Y = CANVAS_HEIGHT - GROUND_HEIGHT - 30;
    
    player.pos.x = clamp(nextX, player.radius, CANVAS_WIDTH - player.radius);
    player.pos.y = clamp(nextY, HORIZON_Y, MAX_Y);
    
    // Aiming & Firing
    
    // Right Joystick Aim/Fire
    if (touchState.current.rightId !== null) {
         const deltaX = touchState.current.rightCurrent.x - touchState.current.rightOrigin.x;
         const deltaY = touchState.current.rightCurrent.y - touchState.current.rightOrigin.y;
         const dist = Math.hypot(deltaX, deltaY);
         
         if (dist > 10) {
             player.rotation = Math.atan2(deltaY, deltaX);
             mousePressedRef.current = true; 
         } else {
             mousePressedRef.current = false;
         }
    } else {
         // Mouse Aim
         player.rotation = Math.atan2(mouseRef.current.y - player.pos.y, mouseRef.current.x - player.pos.x);
    }

    // Shooting: check Mouse, Space bar, or Touch
    const isFiring = mousePressedRef.current || keysRef.current[' '] || keysRef.current['space'];

    if (player.fireCooldown > 0) player.fireCooldown--;
    if (player.muzzleFlash > 0) player.muzzleFlash--;
    if (player.recoil > 0) player.recoil *= 0.8;
    
    if (player.powerupTime > 0) {
      player.powerupTime--;
      if (player.powerupTime <= 0) player.activePowerup = null;
    }

    if (isFiring && player.fireCooldown <= 0) {
      const isRapid = player.activePowerup === PowerupType.RAPID_FIRE;
      const isTriple = player.activePowerup === PowerupType.TRIPLE_SHOT;
      
      const fire = (angleOffset: number) => {
         const angle = player.rotation + angleOffset;
         const muzzleDist = 70; 
         const spawnPos = {
           x: player.pos.x + Math.cos(angle) * muzzleDist,
           y: player.pos.y + Math.sin(angle) * muzzleDist + 5 
         };
         
         bulletsRef.current.push({
           id: Math.random().toString(),
           pos: spawnPos,
           radius: 10, 
           velocity: { x: Math.cos(angle) * GAME_CONFIG.BULLET_SPEED, y: Math.sin(angle) * GAME_CONFIG.BULLET_SPEED },
           damage: GAME_CONFIG.BULLET_DAMAGE,
           lifeTime: 80,
           isEnemy: false,
           rotation: angle,
           animFrame: 0
         });
         
         spawnParticle(spawnPos, COLORS.MUZZLE_FLASH, 5, 4, 3);
      };

      fire(0);
      if (isTriple) { fire(-0.15); fire(0.15); }
      
      player.fireCooldown = isRapid ? GAME_CONFIG.FIRE_RATE_RAPID : GAME_CONFIG.FIRE_RATE_DEFAULT;
      player.recoil = 8;
      player.muzzleFlash = 3;
      screenShakeRef.current = Math.min(screenShakeRef.current + 2, 20);
    }

    // 2. Wave Spawning
    if (!bossActiveRef.current) {
        if (enemiesToSpawnRef.current > 0) {
          if (spawnTimerRef.current <= 0) {
            const waveMult = 1 + (waveRef.current * 0.15);
            const r = Math.random();
            
            // Spawn Config
            let type: Enemy['type'] = 'basic';
            let hp = 40 * waveMult;
            let speed = 2.5;
            let radius = 55; 
            
            if (waveRef.current > 2 && r > 0.85) {
              type = 'tank'; hp = 150 * waveMult; speed = 1.2; radius = 75;
            } else if (waveRef.current > 1 && r > 0.7) {
              type = 'fast'; hp = 25 * waveMult; speed = 5.0; radius = 40;
            }
            
            const spawnMinY = CANVAS_HEIGHT * 0.45;
            const spawnMaxY = CANVAS_HEIGHT - GROUND_HEIGHT - 30;
            
            enemiesRef.current.push({
              id: Math.random().toString(),
              pos: { x: CANVAS_WIDTH + 80, y: rand(spawnMinY, spawnMaxY) },
              radius,
              hp,
              maxHp: hp,
              speed,
              type,
              value: type === 'basic' ? 50 : (type === 'fast' ? 100 : 300),
              rotation: 0,
              animFrame: 0,
              hitFlashTimer: 0
            });
            
            enemiesToSpawnRef.current--;
            spawnTimerRef.current = Math.max(20, 60 - waveRef.current * 2);
          } else {
            spawnTimerRef.current--;
          }
        } else if (enemiesRef.current.length === 0) {
          if (waveTimerRef.current === 0) {
            waveTimerRef.current = GAME_CONFIG.WAVE_DELAY;
            spawnFloatingText({x: CANVAS_WIDTH/2, y: CANVAS_HEIGHT/2}, `WAVE ${waveRef.current + 1}`, '#FFF');
          } else {
            waveTimerRef.current--;
            if (waveTimerRef.current <= 0) {
              waveRef.current++;
              // Boss every 3 waves
              if (waveRef.current % 3 === 0) {
                spawnBoss();
              } else {
                enemiesToSpawnRef.current = 6 + Math.floor(waveRef.current * 2);
              }
            }
          }
        }
    }

    // 3. Entity Updates
    
    // Bullets
    bulletsRef.current.forEach(b => {
      b.pos.x += b.velocity.x;
      b.pos.y += b.velocity.y;
      b.lifeTime--;
    });
    bulletsRef.current = bulletsRef.current.filter(b => b.lifeTime > 0);

    // Enemies
    enemiesRef.current.forEach(e => {
      let vx = 0; let vy = 0;

      if (e.type === 'boss') {
         // Boss AI
         if (e.pos.x > CANVAS_WIDTH - 200) {
            vx = -2;
         } else {
            const targetY = (CANVAS_HEIGHT/2) + Math.sin(frameRef.current * 0.02) * 150;
            const dy = targetY - e.pos.y;
            vy = dy * 0.02;
         }
         
         if (e.attackCooldown && e.attackCooldown > 0) {
             e.attackCooldown--;
         } else {
             const angle = Math.atan2(player.pos.y - e.pos.y, player.pos.x - e.pos.x);
             for(let offset = -0.3; offset <= 0.3; offset+=0.3) {
                 bulletsRef.current.push({
                   id: Math.random().toString(),
                   pos: { x: e.pos.x - 80, y: e.pos.y },
                   radius: 12,
                   velocity: { x: Math.cos(angle + offset) * 8, y: Math.sin(angle + offset) * 8 },
                   damage: 10,
                   lifeTime: 140,
                   isEnemy: true,
                   rotation: angle + offset,
                   animFrame: 0
                 });
             }
             e.attackCooldown = 120;
         }

      } else if (e.type === 'tank') {
        vx = -e.speed;
        e.pos.y = CANVAS_HEIGHT - GROUND_HEIGHT - e.radius + 10; 
      } else {
        const dx = player.pos.x - e.pos.x;
        const dy = player.pos.y - e.pos.y;
        
        const leadX = e.type === 'fast' ? dx + player.velocity.x * 20 : dx;
        const leadY = e.type === 'fast' ? dy + player.velocity.y * 20 : dy;
        const angle = Math.atan2(leadY, leadX);
        
        vx = Math.cos(angle) * e.speed;
        vy = Math.sin(angle) * e.speed;
        
        enemiesRef.current.forEach(other => {
          if (e === other) return;
          const d = dist(e.pos, other.pos);
          const pushDist = e.radius + other.radius;
          if (d < pushDist) {
             const pushAngle = Math.atan2(e.pos.y - other.pos.y, e.pos.x - other.pos.x);
             vx += Math.cos(pushAngle) * 0.5;
             vy += Math.sin(pushAngle) * 0.5;
          }
        });
      }
      
      e.pos.x += vx;
      e.pos.y += vy;
      if (e.hitFlashTimer > 0) e.hitFlashTimer--;

      if (checkCircleCollision(player, e)) {
        player.hp -= 0.5;
        screenShakeRef.current += 1;
        if (player.hp <= 0) endGame();
      }
    });

    // Bullet Collisions
    bulletsRef.current.forEach(b => {
      if (b.isEnemy) {
         if (checkCircleCollision({ pos: b.pos, radius: b.radius}, player)) {
            player.hp -= b.damage;
            screenShakeRef.current += 5;
            b.lifeTime = 0;
            if (player.hp <= 0) endGame();
         }
         return;
      }

      enemiesRef.current.forEach(e => {
        if (dist(b.pos, e.pos) < b.radius + e.radius) {
           e.hp -= b.damage;
           e.hitFlashTimer = 4;
           b.lifeTime = 0;
           spawnParticle(b.pos, COLORS.BULLET, 4, 5);
           
           if (e.hp <= 0) {
             player.score += e.value;
             screenShakeRef.current += e.type === 'boss' ? 30 : 5;
             spawnFloatingText(e.pos, `+${e.value}`, '#FFF');
             
             if (e.type === 'boss') {
                 bossActiveRef.current = false;
                 // Use name based on variant
                 let bossName = "EVIL CAMEL";
                 let charToUnlock = 'camel';
                 if (e.bossVariant === '2pac') { bossName = "2PAC"; charToUnlock = '2pac'; }
                 if (e.bossVariant === 'biggie') { bossName = "BIGGIE"; charToUnlock = 'biggie'; }
                 if (e.bossVariant === 'postmalone') { bossName = "POST MALONE"; charToUnlock = 'postmalone'; }
                 if (e.bossVariant === 'slimshady') { bossName = "SLIM SHADY"; charToUnlock = 'slimshady'; }
                 if (e.bossVariant === 'lilwayne') { bossName = "LIL WAYNE"; charToUnlock = 'lilwayne'; }

                 spawnParticle(e.pos, COLORS.ENEMY_BOSS, 50, 10, 10);
                 spawnFloatingText(e.pos, `${bossName} DEFEATED!`, "#fbbf24");
                 
                 // UNLOCK CHARACTER LOGIC
                 if (unlockCharacter(charToUnlock)) {
                     setTimeout(() => {
                         spawnFloatingText(player.pos, "NEW FIGHTER UNLOCKED!", "#00ff00");
                     }, 1000);
                 }

                 waveRef.current++;
                 enemiesToSpawnRef.current = 6 + Math.floor(waveRef.current * 2);
             } else {
                 spawnParticle(e.pos, COLORS.ENEMY_BASIC, 12, 6, 8);
             }
             
             spawnPowerup(e.pos);
           }
        }
      });
    });

    enemiesRef.current = enemiesRef.current.filter(e => e.hp > 0);

    // Powerups
    powerupsRef.current.forEach(p => p.lifeTime--);
    powerupsRef.current = powerupsRef.current.filter(p => {
      if (p.lifeTime <= 0) return false;
      if (checkCircleCollision(player, p)) {
        spawnFloatingText(player.pos, p.type.replace('_', ' '), '#0f0');
        if (p.type === PowerupType.HEAL) {
          player.hp = Math.min(player.hp + 25, player.maxHp);
        } else {
          player.activePowerup = p.type;
          player.powerupTime = GAME_CONFIG.POWERUP_DURATION;
        }
        return false;
      }
      return true;
    });

    particlesRef.current.forEach(p => {
      p.pos.x += p.velocity.x;
      p.pos.y += p.velocity.y;
      p.velocity.x *= 0.95;
      p.velocity.y += 0.2;
      
      if (p.pos.y > CANVAS_HEIGHT - GROUND_HEIGHT) {
         p.pos.y = CANVAS_HEIGHT - GROUND_HEIGHT;
         p.velocity.y *= -0.6;
      }
      
      p.lifeTime--;
      p.rotation += 0.1;
    });
    particlesRef.current = particlesRef.current.filter(p => p.lifeTime > 0);

    floatingTextsRef.current.forEach(t => {
      t.pos.x += t.velocity.x;
      t.pos.y += t.velocity.y;
      t.lifeTime--;
    });
    floatingTextsRef.current = floatingTextsRef.current.filter(t => t.lifeTime > 0);

    if (screenShakeRef.current > 0) screenShakeRef.current *= 0.9;
    if (screenShakeRef.current < 0.5) screenShakeRef.current = 0;

    if (frameRef.current % 5 === 0) syncUI();
  };

  const endGame = () => {
    gameStateRef.current = GameState.GAME_OVER;
    if (musicRef.current) musicRef.current.pause();
    syncUI();
  };

  const toggleMute = () => {
    setIsMuted(prev => !prev);
  };

  // --- TOUCH HANDLERS ---
  const handleTouchStart = (e: React.TouchEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        const tx = t.clientX - rect.left;
        const ty = t.clientY - rect.top;
        
        // Split screen: Left half = Move, Right half = Aim
        if (tx < rect.width / 2) {
            if (touchState.current.leftId === null) {
                touchState.current.leftId = t.identifier;
                touchState.current.leftOrigin = { x: tx, y: ty };
                touchState.current.leftCurrent = { x: tx, y: ty };
            }
        } else {
            if (touchState.current.rightId === null) {
                touchState.current.rightId = t.identifier;
                touchState.current.rightOrigin = { x: tx, y: ty };
                touchState.current.rightCurrent = { x: tx, y: ty };
            }
        }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        const tx = t.clientX - rect.left;
        const ty = t.clientY - rect.top;

        if (t.identifier === touchState.current.leftId) {
            touchState.current.leftCurrent = { x: tx, y: ty };
        } else if (t.identifier === touchState.current.rightId) {
            touchState.current.rightCurrent = { x: tx, y: ty };
        }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === touchState.current.leftId) {
            touchState.current.leftId = null;
            touchState.current.leftCurrent = touchState.current.leftOrigin; // Snap back
        } else if (t.identifier === touchState.current.rightId) {
            touchState.current.rightId = null;
            touchState.current.rightCurrent = touchState.current.rightOrigin;
            mousePressedRef.current = false; // Stop firing
        }
    }
  };

  // --- RENDERING ---
  const draw = (ctx: CanvasRenderingContext2D) => {
    
    // --- BACKGROUND RENDER (Shared between Game and Menu) ---
    // 1. Sky Gradient (Bright Sega Blue)
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, COLORS.SKY_TOP);
    gradient.addColorStop(1, COLORS.SKY_BOTTOM);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 2. Distant Clouds (Parallax)
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    cloudsRef.current.forEach(c => {
       ctx.save();
       ctx.translate(c.x, c.y);
       ctx.scale(c.scale, c.scale);
       ctx.beginPath();
       ctx.ellipse(0, 0, 60, 20, 0, 0, Math.PI*2);
       ctx.ellipse(30, -10, 40, 25, 0, 0, Math.PI*2);
       ctx.fill();
       ctx.restore();
    });

    // 3. Desert Sand Dunes (Parallax rolling)
    const groundY = CANVAS_HEIGHT - GROUND_HEIGHT;
    
    // Far Dunes (Darker)
    ctx.fillStyle = COLORS.SAND_BACK;
    ctx.beginPath();
    ctx.moveTo(0, CANVAS_HEIGHT);
    for (let x = 0; x <= CANVAS_WIDTH; x+=20) {
      const y = groundY - 40 + Math.sin((x + bgOffsetRef.current * 0.2) * 0.005) * 50;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fill();

    // Foreground Dunes (Bright)
    ctx.fillStyle = COLORS.SAND_FRONT;
    ctx.beginPath();
    ctx.moveTo(0, CANVAS_HEIGHT);
    for (let x = 0; x <= CANVAS_WIDTH; x+=20) {
      const y = groundY + Math.sin((x + bgOffsetRef.current) * 0.015) * 15;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fill();
    
    // Sand Texture Details
    ctx.fillStyle = COLORS.SAND_DETAIL;
    const offset = bgOffsetRef.current;
    for (let i = 0; i < 20; i++) {
        const x = ((i * 150) - (offset * 1.5)) % CANVAS_WIDTH;
        const actualX = x < 0 ? x + CANVAS_WIDTH : x;
        const y = groundY + 40 + (i % 3) * 20; 
        ctx.fillRect(actualX, y, 60, 4);
    }

    // --- MENU OVERLAY (Stars etc) ---
    if (gameStateRef.current === GameState.MENU || gameStateRef.current === GameState.CHARACTER_SELECT) {
       // Dark "Night" Overlay
       ctx.fillStyle = 'rgba(0, 0, 50, 0.7)';
       ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

       // Animated Starfield (over the dark overlay)
       ctx.fillStyle = '#ffffff';
       menuStarsRef.current.forEach(star => {
           ctx.beginPath();
           ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
           ctx.fill();
       });

       // Draw Start Image (Centered and Large)
       if (gameStateRef.current === GameState.MENU && images['START_SCREEN']?.complete && images['START_SCREEN'].naturalWidth > 0) {
           const img = images['START_SCREEN'];
           // Calculate scale to fit nicely without stretching
           const scale = Math.min(CANVAS_WIDTH / img.width, CANVAS_HEIGHT / img.height) * 0.85;
           const w = img.width * scale;
           const h = img.height * scale;
           const x = (CANVAS_WIDTH - w) / 2;
           const y = (CANVAS_HEIGHT - h) / 2; 

           ctx.save();
           ctx.globalAlpha = 1.0; 
           ctx.shadowColor = 'black';
           ctx.shadowBlur = 20;
           ctx.drawImage(img, x, y, w, h);
           ctx.restore();
       }
       return; 
    }

    // --- GAMEPLAY ENTITIES ---
    ctx.save();
    const shakeX = (Math.random() - 0.5) * screenShakeRef.current;
    const shakeY = (Math.random() - 0.5) * screenShakeRef.current;
    ctx.translate(shakeX, shakeY);

    const drawShadow = (pos: Point, radius: number) => {
       ctx.save();
       ctx.translate(pos.x, pos.y + radius * 1.4); 
       ctx.scale(1, 0.4); 
       ctx.beginPath();
       ctx.arc(0, 0, radius * 0.9, 0, Math.PI * 2);
       ctx.fillStyle = 'rgba(0,0,0,0.3)';
       ctx.fill();
       ctx.restore();
    };

    const drawSprite = (pos: Point, radius: number, imgKey: string | undefined, fallbackColor: string, rotation: number = 0, scaleX: number = 1, isHit: boolean = false) => {
      drawShadow(pos, radius); 

      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.scale(scaleX, 1);
      
      const size = radius * 3.4; 

      if (isHit) {
          ctx.filter = 'brightness(500%) sepia(100%) hue-rotate(-50deg)';
      }

      if (imgKey && images[imgKey]?.complete && images[imgKey].naturalWidth > 0) {
         ctx.drawImage(images[imgKey], -size/2, -size/2, size, size);
      } else {
         ctx.fillStyle = fallbackColor;
         ctx.beginPath();
         ctx.arc(0, 0, radius, 0, Math.PI * 2);
         ctx.fill();
      }
      ctx.restore();
    };

    powerupsRef.current.forEach(p => {
       const bob = Math.sin(frameRef.current * 0.1) * 8;
       drawSprite({x: p.pos.x, y: p.pos.y + bob}, p.radius, `POWERUP_${p.type}`, '#fff');
    });

    const p = playerRef.current;
    const recoilX = Math.cos(p.rotation) * p.recoil;
    const recoilY = Math.sin(p.rotation) * p.recoil;
    const visualPos = { x: p.pos.x - recoilX, y: p.pos.y - recoilY };
    const mouseX = mouseRef.current.x;
    const facingRight = mouseX > p.pos.x;
    
    // Determine Player Sprite based on selected character
    const charConfig = CHARACTERS[p.characterId] || CHARACTERS['default'];
    drawSprite(visualPos, p.radius, charConfig.img, charConfig.color, 0, facingRight ? 1 : -1);

    // Gun & Muzzle Flash (No circle)
    ctx.save();
    ctx.translate(visualPos.x, visualPos.y + 10); 
    ctx.rotate(p.rotation);
    
    if (p.muzzleFlash > 0) {
       ctx.fillStyle = COLORS.MUZZLE_FLASH;
       ctx.beginPath();
       const muzzleDist = 60; 
       const spikes = 8;
       const outerRadius = 30 + Math.random() * 10;
       const innerRadius = 15;
       
       for(let i=0; i<spikes*2; i++){
          const r = (i % 2 === 0) ? outerRadius : innerRadius;
          const a = (i / (spikes*2)) * Math.PI * 2;
          const x = muzzleDist + Math.cos(a) * r;
          const y = Math.sin(a) * r;
          if(i===0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
       }
       ctx.closePath();
       ctx.fill();
    }
    ctx.restore();

    // Enemies
    enemiesRef.current.forEach(e => {
       const isFast = e.type === 'fast';
       const isTank = e.type === 'tank';
       const isBoss = e.type === 'boss';
       let key = 'ENEMY_BASIC_IMG';
       if (isFast) key = 'ENEMY_FAST_IMG';
       if (isTank) key = 'ENEMY_TANK_IMG';
       if (isBoss) {
           // Boss variant selection
           if (e.bossVariant === '2pac') key = 'ENEMY_2PAC_IMG';
           else if (e.bossVariant === 'biggie') key = 'ENEMY_BIGGIE_IMG';
           else if (e.bossVariant === 'postmalone') key = 'ENEMY_POSTMALONE_IMG';
           else if (e.bossVariant === 'slimshady') key = 'ENEMY_SLIMSHADY_IMG';
           else if (e.bossVariant === 'lilwayne') key = 'ENEMY_LILWAYNE_IMG';
           else key = 'ENEMY_BOSS_IMG';
       }
       
       const facing = e.pos.x < p.pos.x ? 1 : -1;
       const isHit = e.hitFlashTimer > 0;
       
       drawSprite(e.pos, e.radius, key, isBoss ? COLORS.ENEMY_BOSS : COLORS.ENEMY_BASIC, 0, facing, isHit);
       
       if (isTank && !isBoss) {
          ctx.fillStyle = '#333';
          ctx.fillRect(e.pos.x - 30, e.pos.y - e.radius - 20, 60, 8);
          ctx.fillStyle = '#ef4444';
          const hpPct = Math.max(0, e.hp / (150 * (1 + waveRef.current * 0.15)));
          ctx.fillRect(e.pos.x - 29, e.pos.y - e.radius - 19, 58 * hpPct, 6);
       }
    });

    // Bullets (With Bloom)
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.shadowBlur = 15;
    ctx.shadowColor = COLORS.BULLET;
    bulletsRef.current.forEach(b => {
      ctx.save();
      ctx.translate(b.pos.x, b.pos.y);
      ctx.rotate(b.rotation);
      ctx.fillStyle = b.isEnemy ? '#ff3333' : COLORS.BULLET; 
      ctx.beginPath();
      // Elongated bullet
      ctx.ellipse(0, 0, b.radius * 2, b.radius * 0.8, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    });
    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();

    // Particles
    particlesRef.current.forEach(pt => {
       ctx.save();
       ctx.translate(pt.pos.x, pt.pos.y);
       ctx.rotate(pt.rotation);
       ctx.fillStyle = pt.color;
       ctx.globalAlpha = pt.lifeTime / pt.maxLife;
       ctx.fillRect(-pt.size, -pt.size, pt.size*2, pt.size*2);
       ctx.restore();
    });
    ctx.globalAlpha = 1.0;

    ctx.font = "24px 'Black Ops One'"; 
    ctx.textAlign = "center";
    ctx.strokeStyle = "black";
    ctx.lineWidth = 4;
    floatingTextsRef.current.forEach(t => {
       ctx.strokeText(t.text, t.pos.x, t.pos.y);
       ctx.fillStyle = t.color;
       ctx.fillText(t.text, t.pos.x, t.pos.y);
    });

    ctx.restore(); // End shake/transform

    // Vignette
    const grad = ctx.createRadialGradient(CANVAS_WIDTH/2, CANVAS_HEIGHT/2, CANVAS_HEIGHT/2, CANVAS_WIDTH/2, CANVAS_HEIGHT/2, CANVAS_WIDTH);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.5)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Custom Reticle (Crosshair) - No white circle
    if (gameStateRef.current === GameState.PLAYING) {
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      
      // Hide reticle if using touch controls to fire
      if (touchState.current.rightId === null) {
          ctx.save();
          ctx.translate(mx, my);
          ctx.strokeStyle = "rgba(255, 50, 50, 0.8)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          // Crosshair
          ctx.moveTo(-10, 0); ctx.lineTo(10, 0);
          ctx.moveTo(0, -10); ctx.lineTo(0, 10);
          ctx.stroke();
          
          // Center Dot
          ctx.fillStyle = "#ffaa00";
          ctx.beginPath();
          ctx.arc(0, 0, 2, 0, Math.PI*2);
          ctx.fill();
          ctx.restore();
      }
    }
  };

  const loop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (gameStateRef.current === GameState.PAUSED) {
      draw(ctx);
    } else {
      update();
      draw(ctx);
    }
    requestRef.current = requestAnimationFrame(loop);
  }, []); // Removed dependency to avoid recreation

  useEffect(() => {
    loadImages();
    requestRef.current = requestAnimationFrame(loop);
    
    // Key listeners already in other useEffect

    return () => {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [loop]);

  // Cheat Code Listener
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          // Toggle Cheat Box with Shift + C
          if (e.shiftKey && e.key.toLowerCase() === 'c') {
              activateCheatBox();
              return;
          }
          
          if (showCheatBox) {
              handleCheatInput(e.key);
          }
      };
      
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showCheatBox, exploded, activateCheatBox, handleCheatInput]); 

  // Input listeners
  useEffect(() => {
    const handleKey = (e: KeyboardEvent, isDown: boolean) => {
      keysRef.current[e.key.toLowerCase()] = isDown;
      keysRef.current[e.code] = isDown; 
      
      if (isDown) {
          if (e.key === 'Escape') {
             gameStateRef.current = gameStateRef.current === GameState.PAUSED ? GameState.PLAYING : GameState.PAUSED;
             syncUI();
          }
          if (e.key.toLowerCase() === 'r') {
             if (gameStateRef.current === GameState.GAME_OVER) startGame();
          }
      }
    };
    const onDown = (e: KeyboardEvent) => handleKey(e, true);
    const onUp = (e: KeyboardEvent) => handleKey(e, false);
    
    const onMove = (e: MouseEvent) => {
      const c = canvasRef.current;
      if (!c) return;
      const r = c.getBoundingClientRect();
      const sx = CANVAS_WIDTH / r.width;
      const sy = CANVAS_HEIGHT / r.height;
      mouseRef.current = { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
    };
    const onMouse = (isDown: boolean) => { mousePressedRef.current = isDown; };

    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mousedown', () => onMouse(true));
    window.addEventListener('mouseup', () => onMouse(false));

    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mousedown', () => onMouse(true));
      window.removeEventListener('mouseup', () => onMouse(false));
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      className="relative w-full aspect-video md:max-w-7xl md:rounded-xl overflow-hidden shadow-2xl ring-0 md:ring-4 ring-orange-500/50 touch-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="w-full h-full object-contain cursor-none select-none" />
      
      {/* JOYSTICK OVERLAYS */}
      {uiState.gameState === GameState.PLAYING && (
          <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
              {/* Left Joystick (Move) */}
              {joysticks.left && (
                  <div 
                     className="absolute w-24 h-24 rounded-full border-4 border-white/30 bg-white/10"
                     style={{ 
                         left: joysticks.left.x - 48, 
                         top: joysticks.left.y - 48 
                     }}
                  >
                      <div 
                         className="absolute w-12 h-12 rounded-full bg-blue-500/80 shadow-[0_0_15px_#3b82f6]"
                         style={{
                             left: 24 + joysticks.left.dx - 24,
                             top: 24 + joysticks.left.dy - 24
                         }}
                      />
                  </div>
              )}

              {/* Right Joystick (Aim/Fire) */}
              {joysticks.right && (
                  <div 
                     className="absolute w-24 h-24 rounded-full border-4 border-red-500/30 bg-red-500/10"
                     style={{ 
                         left: joysticks.right.x - 48, 
                         top: joysticks.right.y - 48 
                     }}
                  >
                      <div 
                         className="absolute w-12 h-12 rounded-full bg-red-600/80 shadow-[0_0_15px_#dc2626]"
                         style={{
                             left: 24 + joysticks.right.dx - 24,
                             top: 24 + joysticks.right.dy - 24
                         }}
                      />
                  </div>
              )}
          </div>
      )}

      {/* WARNING OVERLAY */}
      {showWarning && (
        <>
        <style>{`
          @keyframes scroll-stripes {
            0% { background-position: 0 0; }
            100% { background-position: 50px 50px; }
          }
          .hazard-stripes {
            background-image: repeating-linear-gradient(
              45deg,
              rgba(0,0,0,0.5),
              rgba(0,0,0,0.5) 20px,
              rgba(220, 38, 38, 0.3) 20px,
              rgba(220, 38, 38, 0.3) 40px
            );
            animation: scroll-stripes 1s linear infinite;
          }
        `}</style>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-50 overflow-hidden bg-red-900/20 backdrop-blur-sm">
           {/* Animated Stripes Background */}
           <div className="absolute inset-0 hazard-stripes" />

           {/* Top/Bottom Cinematic Bars */}
           <div className="absolute top-0 left-0 w-full h-1/4 bg-gradient-to-b from-black/80 to-transparent" />
           <div className="absolute bottom-0 left-0 w-full h-1/4 bg-gradient-to-t from-black/80 to-transparent" />

           {/* Main Warning Text Container */}
           <div className="relative z-10 flex flex-col items-center animate-bounce">
             {/* Glowing backing for text */}
             <div className="absolute inset-0 bg-red-600/20 blur-3xl rounded-full" />
             
             <h2 className="text-[15vw] md:text-9xl font-['Black_Ops_One'] text-red-600 tracking-widest leading-none drop-shadow-[0_0_10px_rgba(0,0,0,0.8)]" 
                 style={{ WebkitTextStroke: '2px #fff' }}>
               WARNING
             </h2>
             
             <div className="mt-4 md:mt-8 bg-yellow-500 text-black px-8 py-2 md:px-16 md:py-4 transform -skew-x-12 border-4 border-black shadow-[10px_10px_0_rgba(0,0,0,0.5)]">
               <p className="text-2xl md:text-5xl font-bold tracking-[0.2em] transform skew-x-12 whitespace-nowrap">
                 {warningText}
               </p>
             </div>
           </div>
        </div>
        </>
      )}

      {/* CHEAT BOX OVERLAY */}
      {showCheatBox && (
          <div className="absolute inset-0 flex items-center justify-center z-[100] bg-black/70 backdrop-blur-sm">
              <div className={`
                 relative bg-gray-800 border-4 border-yellow-500 p-8 rounded-xl shadow-[0_0_50px_rgba(234,179,8,0.5)] flex flex-col items-center gap-4 transition-transform duration-100
                 ${exploded ? 'scale-[2] opacity-0 bg-white' : 'animate-bounce'}
              `}>
                  <h3 className="text-4xl text-yellow-400 font-['Black_Ops_One'] tracking-widest">CHEAT CODE</h3>
                  
                  {/* Bomb Timer Visual */}
                  <div className="relative w-32 h-32 flex items-center justify-center">
                       <div className="absolute inset-0 bg-red-600 rounded-full animate-pulse blur-md"></div>
                       <div className="relative w-full h-full bg-black rounded-full border-4 border-red-500 flex items-center justify-center">
                           <span className="text-6xl text-red-500 font-mono font-bold">{cheatTimer}</span>
                       </div>
                       {/* Fuse */}
                       <div className="absolute -top-4 right-8 w-8 h-8 border-r-4 border-t-4 border-gray-400 rounded-tr-xl"></div>
                       <div className="absolute -top-6 right-6 w-4 h-4 bg-orange-500 rounded-full animate-ping"></div>
                  </div>
                  
                  <p className="text-gray-400 text-sm">ENTER SEQUENCE BEFORE DETONATION</p>
              </div>
          </div>
      )}

      {/* HUD */}
      {uiState.gameState === GameState.PLAYING && (
        <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between z-10">
          {/* Top Bar */}
          <div className="flex justify-between items-start font-['Black_Ops_One']">
            <div className="flex flex-col gap-1">
              <div className="text-yellow-300 text-xl tracking-wider uppercase drop-shadow-[0_2px_0_#000] stroke-black text-shadow-black">Score</div>
              <div className="text-white text-5xl tracking-wide drop-shadow-[0_4px_0_#000]">
                {uiState.score.toLocaleString()}
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-1">
              <div className="text-yellow-300 text-xl tracking-wider uppercase drop-shadow-[0_2px_0_#000]">Wave {uiState.wave}</div>
              <div className="w-56 h-8 bg-black/60 border-4 border-yellow-500 rounded-full overflow-hidden shadow-[0_0_10px_rgba(234,179,8,0.5)]">
                <div 
                  className={`h-full ${uiState.hp < 30 ? 'bg-red-500' : 'bg-green-500'} transition-all duration-300`} 
                  style={{ width: `${(uiState.hp / uiState.maxHp) * 100}%` }}
                />
              </div>
            </div>
          </div>
          
          {/* BOSS HEALTH BAR */}
          {uiState.bossHp > 0 && (
             <div className="absolute top-20 left-1/2 transform -translate-x-1/2 w-2/3">
                <div className="flex justify-between text-white font-bold uppercase text-sm mb-1 px-1">
                    <span>{uiState.bossName}</span>
                    <span>{(uiState.bossHp / uiState.bossMaxHp * 100).toFixed(0)}%</span>
                </div>
                <div className="w-full h-8 bg-black/80 border-4 border-red-900 rounded-sm overflow-hidden">
                    <div 
                       className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-200"
                       style={{ width: `${Math.max(0, uiState.bossHp / uiState.bossMaxHp * 100)}%` }}
                    />
                </div>
             </div>
          )}

          {/* Bottom Notifications */}
          <div className="flex justify-center font-['Black_Ops_One']">
            {uiState.powerup && (
              <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-8 py-3 text-3xl uppercase tracking-wider animate-bounce rounded-full shadow-[0_0_20px_rgba(251,191,36,0.8)] border-4 border-white transform rotate-[-2deg]">
                {uiState.powerup.replace('_', ' ')}
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Mute Button */}
      <button 
        onClick={toggleMute}
        className="absolute bottom-4 right-4 z-50 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full border-2 border-white/30 transition-all pointer-events-auto"
        title={isMuted ? "Unmute" : "Mute"}
      >
        {isMuted ? (
           <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
             <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75 19.5 12m0 0 2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6 4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
           </svg>
        ) : (
           <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
             <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
           </svg>
        )}
      </button>

      {/* CHARACTER SELECT SCREEN */}
      {uiState.gameState === GameState.CHARACTER_SELECT && (
         <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-auto z-40 bg-black/90 backdrop-blur-md">
             {/* Background Grid Effect */}
             <div className="absolute inset-0 opacity-20 pointer-events-none" 
                  style={{ backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
             </div>

             <h2 className="text-4xl md:text-6xl text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400 font-['Black_Ops_One'] mb-8 tracking-[0.2em] drop-shadow-[0_4px_0_#000] z-10 text-center">
                 CHOOSE YOUR WARRIOR
             </h2>
             
             {/* Main Layout: Left (Grid) | Right (Preview - optional, sticking to Grid for simplicity on mobile) */}
             <div className="flex flex-wrap gap-4 md:gap-6 justify-center max-w-5xl p-4 z-10 overflow-y-auto max-h-[60vh]">
                 {Object.entries(CHARACTERS).map(([key, char]) => {
                     const isUnlocked = unlockedCharacters.includes(key);
                     const isSelected = selectedCharacter === key;
                     
                     return (
                         <div 
                           key={key}
                           onClick={() => {
                               if (isUnlocked) setSelectedCharacter(key);
                           }}
                           className={`
                              relative w-28 h-28 md:w-36 md:h-36 rounded-xl border-4 transition-all duration-200 cursor-pointer flex flex-col items-center justify-center bg-gray-900 overflow-hidden group
                              ${isSelected ? 'border-yellow-400 scale-110 shadow-[0_0_20px_#facc15] z-20' : 'border-gray-700 hover:border-white hover:scale-105'}
                              ${!isUnlocked ? 'opacity-50 grayscale' : ''}
                           `}
                         >
                            {/* Card Content */}
                            {isUnlocked ? (
                                <>
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent z-10" />
                                  <div className="w-full h-full relative p-2">
                                      {/* Character Image */}
                                      {images[char.img] ? (
                                          <img 
                                            src={images[char.img].src} 
                                            alt={char.name} 
                                            className="w-full h-full object-contain drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] transition-transform duration-300 group-hover:scale-110" 
                                          />
                                      ) : (
                                          <div className="w-full h-full rounded-full bg-gray-700" />
                                      )}
                                  </div>
                                  <div className={`absolute bottom-1 w-full text-center text-[10px] md:text-xs font-['Black_Ops_One'] uppercase tracking-wider z-20 ${isSelected ? 'text-yellow-400' : 'text-gray-300'}`}>
                                      {char.name}
                                  </div>
                                </>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-gray-600">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8 mb-1">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                                    </svg>
                                    <span className="font-['Black_Ops_One'] text-[10px]">LOCKED</span>
                                </div>
                            )}
                            
                            {/* Selection Pulse */}
                            {isSelected && (
                                <div className="absolute inset-0 bg-yellow-400/10 animate-pulse pointer-events-none" />
                            )}
                         </div>
                     );
                 })}
             </div>

             {/* Selected Character Name Big */}
             <div className="h-16 flex items-center justify-center z-10 mt-4">
                 <div className="text-3xl md:text-5xl font-['Black_Ops_One'] text-yellow-400 tracking-widest drop-shadow-[0_0_10px_rgba(250,204,21,0.5)] uppercase">
                    {CHARACTERS[selectedCharacter]?.name || "UNKNOWN"}
                 </div>
             </div>

             <button 
                 onClick={startGame}
                 className="mt-6 px-12 py-3 bg-red-600 hover:bg-red-500 text-white text-3xl font-['Black_Ops_One'] tracking-widest uppercase rounded skew-x-[-12deg] shadow-[0_0_20px_#dc2626] border-2 border-red-400 transition-all hover:scale-105 active:scale-95 group relative overflow-hidden"
             >
                 <span className="relative z-10 block skew-x-[12deg]">FIGHT!</span>
                 <div className="absolute inset-0 bg-white/20 transform -translate-x-full group-hover:translate-x-full transition-transform duration-300 skew-x-[-12deg]" />
             </button>
         </div>
      )}

      {/* Menus */}
      {uiState.gameState === GameState.MENU && (
        <div className="absolute inset-0 flex flex-col items-center justify-end z-10 pb-8 pointer-events-auto">
           {/* Bottom: Flashing Press Start */}
           <div className="flex flex-col items-center gap-4">
               <style>{`
                 @keyframes blink {
                    0%, 49% { opacity: 1; }
                    50%, 100% { opacity: 0; }
                 }
                 .nes-blink {
                    animation: blink 0.8s infinite step-end;
                 }
               `}</style>
               <button 
                 onClick={goToCharacterSelect}
                 className="text-2xl md:text-4xl text-white font-['Black_Ops_One'] tracking-[0.2em] uppercase nes-blink hover:scale-110 transition-transform drop-shadow-[0_2px_0_#000]"
               >
                 PRESS START
               </button>
               
               <div className="text-gray-300 text-xs flex gap-6 bg-black/60 px-6 py-2 rounded-xl border border-white/20 font-['Black_Ops_One']">
                   <div className="flex flex-col items-center">
                       <span className="font-bold text-yellow-400">ARROWS</span>
                       <span className="text-[10px] opacity-80">MOVE</span>
                   </div>
                   <div className="w-px bg-gray-500"></div>
                   <div className="flex flex-col items-center">
                       <span className="font-bold text-yellow-400">SPACE</span>
                       <span className="text-[10px] opacity-80">SHOOT</span>
                   </div>
                   <div className="w-px bg-gray-500"></div>
                   <div className="flex flex-col items-center">
                       <span className="font-bold text-yellow-400">ESC</span>
                       <span className="text-[10px] opacity-80">PAUSE</span>
                   </div>
               </div>
           </div>
        </div>
      )}

      {/* PAUSE MENU */}
      {uiState.gameState === GameState.PAUSED && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center font-['Black_Ops_One'] z-30 pointer-events-auto">
           <div className="text-center">
             <h1 className="text-6xl text-white mb-8 tracking-widest">PAUSED</h1>
             <button 
               onClick={() => {
                   gameStateRef.current = GameState.PLAYING;
                   syncUI();
               }}
               className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white text-2xl uppercase border-2 border-white"
             >
               RESUME
             </button>
           </div>
        </div>
      )}

      {uiState.gameState === GameState.GAME_OVER && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center font-['Black_Ops_One'] z-30 pointer-events-auto">
           <div className="text-center">
             <h1 className="text-8xl text-red-600 mb-4 drop-shadow-[6px_6px_0_#fff] tracking-wide" style={{WebkitTextStroke: '3px white'}}>
               GAME OVER
             </h1>
             
             <div className="mb-10">
               <div className="text-white text-4xl mb-2">SCORE: <span className="text-yellow-400">{uiState.score}</span></div>
               <div className="text-white text-2xl">WAVE: <span className="text-blue-400">{uiState.wave}</span></div>
             </div>

             <button 
               onClick={goToCharacterSelect}
               className="group relative px-12 py-6 bg-blue-600 hover:bg-blue-500 text-white text-4xl tracking-widest uppercase transition-all shadow-[0_0_20px_#0088ff] active:shadow-none active:translate-y-[6px] border-4 border-white"
             >
               CONTINUE?
             </button>
           </div>
        </div>
      )}
    </div>
  );
};