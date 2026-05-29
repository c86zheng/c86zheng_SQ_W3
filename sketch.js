
const STATE_START = "start";
const STATE_FIGHT = "fight";
const STATE_WIN   = "win";

let gameState = STATE_START;
let winner = null; // stores "P1" or "P2" when the game ends

let sushi1Img;
let sushi2Img;
let bgImg;

// ------------------------------------------------------------
// SOUNDS
// Loaded in preload() so they are ready before the game starts.
// punchSounds is an array — a random one plays on each hit
// so punches don't sound identical every time.
// ------------------------------------------------------------
let punchSounds = [];
let winSound;
let bgMusic;

// ------------------------------------------------------------
// FIGHTER CLASS
// Extended from Example 1 to include health, attacking,
// hit detection, and a visual flash when hit.
// ------------------------------------------------------------
class Fighter {
  // ----------------------------------------------------------
  // constructor()
  // Sets up all properties for this fighter instance.
  // "label" is new here — used to identify P1 or P2 when
  // determining the winner.
  // ----------------------------------------------------------
  constructor(x, y, colour, controls, label, sprite) {
    // Position and physics
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.speed = 0.5;
    this.maxSpeed = 4;
    this.friction = 0.78;
    this.r = 28;
    this.isGrounded = true;

    // Appearance
    this.colour = colour;
    this.label = label; // "P1" or "P2"
    this.sprite = sprite;
    this.blobT = random(100);

    // Controls
    this.controls = controls;

    // Health — 3 hits to lose
    this.maxHealth = 3;
    this.health = 3;

    // Attack state
    this.isAttacking = false;
    this.attackTimer = 0;
    this.attackDuration = 18;  // frames the punch stays active
    this.attackCooldown = 0;   // frames until this fighter can attack again
    this.punchReach = 55;      // how far the fist extends in pixels
    this.punchDir = 1;         // direction of punch: 1 = right, -1 = left

    // Block state
    this.isBlocking = false;

    // Hit flash — briefly turns white when hit
    this.hitFlash = 0;

    // Prevents registering more than one hit per attack swing
    this.hitLanded = false;
  }

  // ----------------------------------------------------------
  // update()
  // Called every frame during the FIGHT state.
  // Returns early if the game is not in progress.
  // ----------------------------------------------------------
  update() {
    if (gameState !== STATE_FIGHT) return;

    this.handleInput();
    this.applyPhysics();

    // Count down attack timer — ends the attack after attackDuration frames
    if (this.isAttacking) {
      this.attackTimer--;
      if (this.attackTimer <= 0) {
        this.isAttacking = false;
        this.hitLanded = false;
        this.attackCooldown = 20; // short cooldown before next punch
      }
    }

    // Count down cooldown each frame until it reaches zero
    if (this.attackCooldown > 0) this.attackCooldown--;

    // Count down hit flash each frame until it reaches zero
    if (this.hitFlash > 0) this.hitFlash--;
  }

  // ----------------------------------------------------------
  // handleInput()
  // Reads keyboard state for this fighter's specific keys.
  // keyIsDown() returns true every frame the key is held —
  // this gives smooth continuous movement.
  // ----------------------------------------------------------
  handleInput() {
    if (keyIsDown(this.controls.left))  this.vx -= this.speed;
    if (keyIsDown(this.controls.right)) this.vx += this.speed;

    // Clamp speed — prevents infinite acceleration
    this.vx = constrain(this.vx, -this.maxSpeed, this.maxSpeed);

    // Friction — gradually slows the fighter when no key is pressed
    if (!keyIsDown(this.controls.left) && !keyIsDown(this.controls.right)) {
      this.vx *= this.friction;
    }

    // Block state — fighters cannot block while attacking
    this.isBlocking = keyIsDown(this.controls.block) && !this.isAttacking;
  }

  // ----------------------------------------------------------
  // applyPhysics()
  // Moves the fighter, applies gravity, and lands on the floor/platform.
  // ----------------------------------------------------------
  applyPhysics() {
    let previousY = this.y;

    this.x += this.vx;
    this.x = constrain(this.x, this.r, width - this.r);

    this.vy += gravity;
    this.y += this.vy;
    this.isGrounded = false;

    this.landOnPlatform(previousY);
    this.landOnFloor();
  }

  // ----------------------------------------------------------
  // jump()
  // Starts a jump only when the fighter is standing on a surface.
  // ----------------------------------------------------------
  jump() {
    if (!this.isGrounded) return;

    this.vy = jumpStrength;
    this.isGrounded = false;
  }

  // ----------------------------------------------------------
  // landOnPlatform()
  // Lets fighters land on top of the center platform while falling.
  // ----------------------------------------------------------
  landOnPlatform(previousY) {
    let previousBottom = previousY + this.r;
    let currentBottom = this.y + this.r;
    let isFalling = this.vy >= 0;
    let overlapsPlatformX =
      this.x + this.r > platformX &&
      this.x - this.r < platformX + platformW;

    if (
      isFalling &&
      overlapsPlatformX &&
      previousBottom <= platformY &&
      currentBottom >= platformY
    ) {
      this.y = platformY - this.r;
      this.vy = 0;
      this.isGrounded = true;
    }
  }

  // ----------------------------------------------------------
  // landOnFloor()
  // Keeps fighters from falling through the main floor.
  // ----------------------------------------------------------
  landOnFloor() {
    if (this.y + this.r >= groundY) {
      this.y = groundY - this.r;
      this.vy = 0;
      this.isGrounded = true;
    }
  }

  // ----------------------------------------------------------
  // startAttack()
  // Called from keyPressed() when the attack key is pressed.
  // Uses keyPressed() rather than keyIsDown() so the punch
  // fires once per press, not every frame.
  // targetX is the opponent's x position — used to set the
  // direction the fist extends.
  // ----------------------------------------------------------
  startAttack(targetX) {
    // Do nothing if already attacking, blocking, or in cooldown
    if (this.isAttacking || this.isBlocking || this.attackCooldown > 0) return;

    this.isAttacking = true;
    this.attackTimer = this.attackDuration;
    this.hitLanded = false;

    // Punch extends toward the opponent
    this.punchDir = targetX > this.x ? 1 : -1;

    // Pick a random punch sound from the array for variety
    let randomPunch = punchSounds[floor(random(punchSounds.length))];
    randomPunch.play();
  }

  // ----------------------------------------------------------
  // getPunchX()
  // Returns the x position of the fist tip.
  // Used in checkHits() to test whether the punch connects.
  // ----------------------------------------------------------
  getPunchX() {
    return this.x + this.punchDir * this.punchReach;
  }

  // ----------------------------------------------------------
  // takeHit()
  // Called on this fighter when the opponent's punch connects.
  // Blocked punches deal no damage.
  // ----------------------------------------------------------
  takeHit() {
    if (this.isBlocking) return; // blocked — no damage

    this.health--;
    this.hitFlash = 12; // flash white for 12 frames

    // If health reaches zero, end the game
    if (this.health <= 0) {
      this.health = 0;
      // The winner is whichever fighter is NOT this one
      endGame(this.label === "P1" ? "P2" : "P1");
    }
  }

  // ----------------------------------------------------------
  // draw()
  // Draws the shield ring, fist, and sushi body.
  // push() and pop() isolate drawing styles to this method.
  // ----------------------------------------------------------
  draw() {
    push();

    // Shield ring when blocking
    if (this.isBlocking) {
      noFill();
      stroke(255, 255, 255, 150);
      strokeWeight(3);
      ellipse(this.x, this.y, (this.r + 16) * 2, (this.r + 16) * 2);
    }

    // Draw fist when attacking
    if (this.isAttacking) {
      fill(this.hitFlash > 0 ? color(255) : this.colour);
      noStroke();
      ellipse(this.getPunchX(), this.y, 20, 20);
    }

    // Sushi body
    imageMode(CENTER);
    let spriteHeight = this.r * 2;
    let spriteWidth = spriteHeight * (this.sprite.width / this.sprite.height);
    image(this.sprite, this.x, this.y, spriteWidth, spriteHeight);

    if (this.hitFlash > 0) {
      fill(255, 170);
      noStroke();
      ellipse(this.x, this.y, spriteWidth, spriteHeight);
    }

    pop();

    // Advance blob animation each frame
    this.blobT += 0.015;
  }
}


// ============================================================
// GLOBAL VARIABLES
// ============================================================
let fighter1, fighter2;
let groundY;
let platformX;
let platformY;
let platformW = 300;
let platformH = 10;
let platformTopOffset = 100;
let gravity = 0.6;
let jumpStrength = -12; // With gravity 0.6, this clears the platform by 20 pixels.

// ============================================================
// preload()
// Runs once before setup(). Loads all sounds so they are
// ready before the game starts.
// ============================================================
function preload() {
  // Load all 9 punch sounds into an array
  // A random one will be picked each time a punch lands
  for (let i = 1; i <= 9; i++) {
    punchSounds.push(loadSound("assets/sounds/punch_" + i + ".wav"));
  }
  winSound = loadSound("assets/sounds/win.wav");
  bgMusic  = loadSound("assets/sounds/background.mp3");

  sushi1Img = loadImage("assets/images/sushi1.png");
  sushi2Img = loadImage("assets/images/sushi2.png");
  bgImg = loadImage("assets/images/sushibg.png");
}

// ============================================================
// setup()
// Runs once at the very start of the sketch.
// Creates the canvas and both fighter instances.
// ============================================================
function setup() {
  createCanvas(800, 450);
  groundY = 385;
  platformX = width / 2 - platformW / 2;
  platformY = groundY - platformTopOffset;
  setupFighters();
}

// ------------------------------------------------------------
// setupFighters()
// Creates both fighter instances with their starting
// positions, colours, and control keys.
// Called on setup and again on rematch to reset state.
//
// Key code reference:
// 65=A, 68=D, 87=W, 70=F, 83=S (Player 1)
// LEFT_ARROW=37, RIGHT_ARROW=39, UP_ARROW=38, 75=K, DOWN_ARROW=40 (Player 2)
// ------------------------------------------------------------
function setupFighters() {
  fighter1 = new Fighter(
    200,
    groundY - 28,
    color("#fd7311"),
    { left: 65, right: 68, jump: 87, attack: 70, block: 83 }, // A D W F S
    "P1",
    sushi1Img,
  );

  fighter2 = new Fighter(
    600,
    groundY - 28,
    color("#c81c20"),
    { left: LEFT_ARROW, right: RIGHT_ARROW, jump: UP_ARROW, attack: 75, block: DOWN_ARROW }, // Arrows Up K Down
    "P2",
    sushi2Img,
  );
}

// ============================================================
// draw()
// Runs repeatedly in a loop after setup() finishes.
// Switches what gets drawn based on the current game state.
// ============================================================
function draw() {
  image(bgImg, 0, 0, 800, 450);

  if (gameState === STATE_START) {
    drawStartScreen();
  } else if (gameState === STATE_FIGHT) {
    drawArena();
    updateAndDrawFighters();
    checkHits();
    drawHealthBars();
    drawFightHUD();
  } else if (gameState === STATE_WIN) {
    drawArena();
    fighter1.draw();
    fighter2.draw();
    drawWinScreen();
  }
}

// ============================================================
// GAME STATE FUNCTIONS
// ============================================================

// ------------------------------------------------------------
// startGame()
// Transitions to the FIGHT state, resets fighters,
// and starts background music.
// ------------------------------------------------------------
function startGame() {
  gameState = STATE_FIGHT;
  winner = null;
  setupFighters();
  if (!bgMusic.isPlaying()) {
    bgMusic.loop();
  }
}

// ------------------------------------------------------------
// endGame()
// Transitions to the WIN state, stores the winner's label,
// stops music, and plays the win sound.
// ------------------------------------------------------------
function endGame(winnerLabel) {
  gameState = STATE_WIN;
  winner = winnerLabel;
  bgMusic.stop();
  winSound.play();
}

// ============================================================
// DRAW FUNCTIONS
// ============================================================

// ------------------------------------------------------------
// drawStartScreen()
// Displayed before the game begins.
// ------------------------------------------------------------
function drawStartScreen() {
  // Text backdrop
  noStroke();
  fill(0, 0, 0, 200);
  rectMode(CENTER);
  rect(width / 2, height / 2 , 560, 250, 8);
  rectMode(CORNER);

  // Title
  fill(255);
  textAlign(CENTER);
  textSize(52);
  text("BLOB BRAWL", width / 2, height / 2 - 60);

  // Subtitle
  fill(160);
  textSize(18);
  text("First to land 3 hits wins", width / 2, height / 2 - 20);

  // Controls — each player shown in their colour
  textSize(14);
  fill("#fd7311");
  text("P1: A/D move   W jump   F attack   S/down block", width / 2, height / 2 + 30);
  fill("#c81c20");
  text("P2: Arrows move   Up jump   K attack   Down Arrow block", width / 2, height / 2 + 55);

  // Start prompt
  fill(255);
  textSize(16);
  text("Press ENTER to start", width / 2, height / 2 + 110);
}

// ------------------------------------------------------------
// drawWinScreen()
// Displayed after a fighter's health reaches zero.
// A semi-transparent overlay sits on top of the arena.
// ------------------------------------------------------------
function drawWinScreen() {
  // Semi-transparent overlay
  fill(0, 0, 0, 160);
  rect(0, 0, width, height);

  // Winner text — shown in the winner's colour
  fill(winner === "P1" ? color("#fd7311") : color("#c81c20"));
  textAlign(CENTER);
  textSize(56);
  text(winner + " WINS!", width / 2, height / 2 - 30);

  // Rematch prompt
  fill(255);
  textSize(18);
  text("Press ENTER to rematch", width / 2, height / 2 + 40);
}

// ------------------------------------------------------------
// drawArena()
// Draws the ground plane, platform, and dividing line.
// ------------------------------------------------------------
function drawArena() {
  fill(0,0,0,0);
  noStroke();
  rect(0, groundY, width, height - groundY);

  fill(70, 36, 14, 225);
  rect(platformX, platformY, platformW, platformH, 5);

  stroke(80);
  strokeWeight(1);
  line(0, groundY, width, groundY);

  stroke(32, 160, 224, 170);
  line(platformX, platformY, platformX + platformW, platformY);
}

// ------------------------------------------------------------
// updateAndDrawFighters()
// Updates physics and input, then draws both fighters.
// Separated from draw() to keep it readable.
// ------------------------------------------------------------
function updateAndDrawFighters() {
  fighter1.update();
  fighter2.update();
  fighter1.draw();
  fighter2.draw();
}

// ------------------------------------------------------------
// checkHits()
// Called every frame during the FIGHT state.
// Checks if an attacking fighter's fist overlaps the opponent.
// hitLanded prevents the same swing from registering twice.
// ------------------------------------------------------------
function checkHits() {
  // Fighter 1 hitting Fighter 2
  if (fighter1.isAttacking && !fighter1.hitLanded) {
    let fistX = fighter1.getPunchX();
    let punchDistance = dist(fistX, fighter1.y, fighter2.x, fighter2.y);
    if (punchDistance < fighter2.r + 10) {
      fighter2.takeHit();
      fighter1.hitLanded = true;
    }
  }

  // Fighter 2 hitting Fighter 1
  if (fighter2.isAttacking && !fighter2.hitLanded) {
    let fistX = fighter2.getPunchX();
    let punchDistance = dist(fistX, fighter2.y, fighter1.x, fighter1.y);
    if (punchDistance < fighter1.r + 10) {
      fighter1.takeHit();
      fighter2.hitLanded = true;
    }
  }
}

// ------------------------------------------------------------
// drawHealthBars()
// Drawn as two rect()s per player — a grey background bar
// and a coloured health bar that shrinks as health decreases.
// map() converts health (0–3) to bar width in pixels.
// ------------------------------------------------------------
function drawHealthBars() {
  let barW    = 200;
  let barH    = 18;
  let barY    = 45;
  let padding = 30;

  // Player 1 health bar — left side, fills left to right
  let p1W = map(fighter1.health, 0, fighter1.maxHealth, 0, barW);
  fill(40);
  rect(padding, barY, barW, barH, 4);
  fill("#fd7311");
  rect(padding, barY, p1W, barH, 4);

  // Player 2 health bar — right side, fills right to left
  let p2W = map(fighter2.health, 0, fighter2.maxHealth, 0, barW);
  fill(40);
  rect(width - padding - barW, barY, barW, barH, 4);
  fill("#c81c20");
  rect(width - padding - p2W, barY, p2W, barH, 4);

  // Labels
  fill(255);
  textSize(13);
  noStroke();
  textAlign(LEFT);
  text("P1", padding, barY - 5);
  textAlign(RIGHT);
  text("P2", width - padding, barY - 5);
}

// ------------------------------------------------------------
// drawFightHUD()
// HUD = Heads Up Display.
// Shows controls at the bottom of the screen during a fight.
// ------------------------------------------------------------
function drawFightHUD() {
  noStroke();
  fill(120);
  textSize(12);
  textAlign(LEFT);
  text("A/D move   W jump   F attack   S/down block", 16, height - 12);
  textAlign(RIGHT);
  text("Arrows move   Up jump   K attack   Down Arrow block", width - 16, height - 12);
}

// ============================================================
// keyPressed()
// Used for actions that fire ONCE per press (attack, start).
// keyIsDown() is used for held actions (movement, blocking).
// This is an important distinction — keyPressed() fires once
// per keypress, keyIsDown() fires every frame the key is held.
// ============================================================
function keyPressed() {
  // Start or rematch — only responds to ENTER
  if (keyCode === ENTER) {
    if (gameState === STATE_START || gameState === STATE_WIN) {
      startGame();
    }
  }

  // Player 1 attack — F key (keyCode 70)
  if (keyCode === 70 && gameState === STATE_FIGHT) {
    fighter1.startAttack(fighter2.x);
  }

  // Player 2 attack — K key (keyCode 75)
  if (keyCode === 75 && gameState === STATE_FIGHT) {
    fighter2.startAttack(fighter1.x);
  }

  // Player 1 jump — W key (keyCode 87)
  if (keyCode === 87 && gameState === STATE_FIGHT) {
    fighter1.jump();
  }

  // Player 2 jump — Up Arrow
  if (keyCode === UP_ARROW && gameState === STATE_FIGHT) {
    fighter2.jump();
  }
}
