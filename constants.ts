// --- CONFIGURATION ---
export const CANVAS_WIDTH = 1280;
export const CANVAS_HEIGHT = 720;
export const GROUND_HEIGHT = 120; // Increased for parallax dunes

// --- ASSET HOOKS ---
const BASE_URL = "https://cdn.jsdelivr.net/gh/mikeyspinz-beep/BobbyGame@5eb2845c5728dd2cf3031cf3e72ab2ca1a6c1f78";

export const ASSETS = {
  // Updated to the specific raw link provided for reliability
  START_SCREEN: `https://raw.githubusercontent.com/mikeyspinz-beep/BobbyGame/7441c09d0ab88c26e89070c6cb010366d8551250/STARTSCREEN_IMG.png`,
  PLAYER_IMG: `${BASE_URL}/PLAYER_IMG.png`, 
  // All enemies use the same sprite for now, as requested
  ENEMY_BASIC_IMG: `${BASE_URL}/ENEMY_IMG.png`,
  ENEMY_FAST_IMG: `${BASE_URL}/ENEMY_IMG.png`, 
  ENEMY_TANK_IMG: `${BASE_URL}/ENEMY_IMG.png`, 
  
  // BOSS IMAGES
  ENEMY_BOSS_IMG: `${BASE_URL}/EVIL%20ENEMY_IMG.png`, // Evil Camel
  ENEMY_2PAC_IMG: `https://raw.githubusercontent.com/mikeyspinz-beep/public-assets/cd6cb9279c402b567896dccd31895bbff5861c01/ENEMY_2PAC_IMG.png`,
  ENEMY_BIGGIE_IMG: `https://raw.githubusercontent.com/mikeyspinz-beep/public-assets/a3edf9a829755491bc4b1b82437b462ac4d10bbc/ENEMY_BIGGIE_IMG.png`,
  ENEMY_POSTMALONE_IMG: `https://raw.githubusercontent.com/mikeyspinz-beep/public-assets/6c0359eadf48c1788c81ab1e15336a12848e7105/ENEMY_POSTMALONE_IMG.png`,
  ENEMY_SLIMSHADY_IMG: `https://raw.githubusercontent.com/mikeyspinz-beep/public-assets/3d108da46cdf5b306f3ce0e80773b47b7f95cdac/ENEMY_SLIMSHADY_IMG.png`,
  ENEMY_LILWAYNE_IMG: `https://raw.githubusercontent.com/mikeyspinz-beep/public-assets/9a9d52ecfca4d1ac9f055d7ba8c25e74eb2ea2b0/ENEMY_LILWAYNE_IMG.png`,
  
  BULLET_IMG: `${BASE_URL}/BULLET_IMG.png`, 
  POWERUP_HEAL: `https://raw.githubusercontent.com/mikeyspinz-beep/BobbyGame/908dcf9d8b40d60e7d729045a4494335e2f3959f/HEAL.png`, 
  POWERUP_RAPID_FIRE: `https://raw.githubusercontent.com/mikeyspinz-beep/BobbyGame/7fce83377f4abc2e40ea85c29c5ed86cdad3889d/RAPIDFIRE.png`,
  POWERUP_TRIPLE_SHOT: `https://raw.githubusercontent.com/mikeyspinz-beep/public-assets/a1fb85c13f1fd3c6823aac1120b4067ff4ba13eb/Triple%20Shot.png`,
  
  MUSIC: `${BASE_URL}/Song.mp3`,
};

// Playable Character Config
export const CHARACTERS: Record<string, { name: string, img: string, color: string }> = {
  default: { name: 'DKAY', img: 'PLAYER_IMG', color: '#0284c7' },
  camel: { name: 'EVIL CAMEL', img: 'ENEMY_BOSS_IMG', color: '#581c87' },
  '2pac': { name: '2PAC', img: 'ENEMY_2PAC_IMG', color: '#fbbf24' },
  biggie: { name: 'BIGGIE', img: 'ENEMY_BIGGIE_IMG', color: '#ef4444' },
  postmalone: { name: 'POST MALONE', img: 'ENEMY_POSTMALONE_IMG', color: '#ffffff' },
  slimshady: { name: 'SLIM SHADY', img: 'ENEMY_SLIMSHADY_IMG', color: '#cccccc' },
  lilwayne: { name: 'LIL WAYNE', img: 'ENEMY_LILWAYNE_IMG', color: '#a855f7' },
};

export const COLORS = {
  // Desert Theme (Sega Brightness)
  SKY_TOP: '#0055aa',     // Deep Sega Blue
  SKY_BOTTOM: '#66ccff',  // Bright Cyan Horizon
  
  // Desert Ground
  SAND_BACK: '#d97706',   // Darker Amber (Shadow Dunes)
  SAND_FRONT: '#fbbf24',  // Bright Amber (Foreground Sand)
  SAND_DETAIL: '#b45309', // Texture specks
  
  PLAYER: '#0284c7',      // Bright Blue
  ENEMY_BASIC: '#ef4444',
  ENEMY_FAST: '#a855f7',
  ENEMY_TANK: '#7f1d1d',
  ENEMY_BOSS: '#581c87',  
  
  BULLET: '#facc15',      
  MUZZLE_FLASH: '#ffffff',
  
  UI_TEXT: '#ffffff',
  UI_BG: 'rgba(0, 0, 0, 0.6)'
};

export const GAME_CONFIG = {
  PLAYER_SPEED: 7,
  PLAYER_MAX_HP: 100,
  
  BULLET_SPEED: 18,
  BULLET_DAMAGE: 20, 
  
  FIRE_RATE_DEFAULT: 12, 
  FIRE_RATE_RAPID: 4,
  
  POWERUP_DURATION: 400, // ~6.5 seconds
  POWERUP_DROP_CHANCE: 0.15,
  
  WAVE_DELAY: 180, 
  
  // Visuals
  SHADOW_OFFSET_Y: 15,
  SHADOW_SCALE: 0.8,
  SHADOW_ALPHA: 0.3
};