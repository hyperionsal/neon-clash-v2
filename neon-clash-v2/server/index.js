const colyseus = require("colyseus");
const schema = require("@colyseus/schema");
const http = require("http");
const express = require("express");

const { Schema, MapSchema } = schema;

class Player extends Schema {
  x = 400;
  y = 100;
  vx = 0;
  vy = 0;
  damage = 0;
  stock = 3;
  color = "#0000FF";
  facing = 1;
  isAttacking = false;
  keys = {}; // object olarak tutuyoruz (JSON.stringify gerekmez)
}

schema.defineTypes(Player, {
  x: "number",
  y: "number",
  vx: "number",
  vy: "number",
  damage: "number",
  stock: "number",
  color: "string",
  facing: "number",
  isAttacking: "boolean"
});

class State extends Schema {
  players = new MapSchema();
  timeLeft = 90;
  winner = "";
}

schema.defineTypes(State, {
  players: { map: Player },
  timeLeft: "number",
  winner: "string"
});

class GameRoom extends colyseus.Room {
  maxClients = 2;

  onCreate(options) {
    this.setState(new State());
    this.setSimulationInterval(1000 / 60);
    console.log("Oda oluşturuldu:", this.roomId);
  }

  onJoin(client, options) {
    console.log("Oyuncu katıldı:", client.sessionId);
    const player = new Player();
    player.color = this.clients.length === 1 ? "#0000FF" : "#FF0000";
    player.x = this.clients.length === 1 ? 200 : 800;
    this.state.players.set(client.sessionId, player);
  }

  onMessage(client, message) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    if (message.type === "input") {
      player.keys = message.keys;
    }
  }

  onLeave(client) {
    this.state.players.delete(client.sessionId);
    console.log("Oyuncu ayrıldı:", client.sessionId);
  }

  update() {
    this.state.timeLeft -= 1/60;
    if (this.state.timeLeft <= 0) {
      this.state.winner = "Zaman Bitti!";
    }

    this.state.players.forEach((player, id) => {
      // Fizik basit
      let keys = player.keys || {};
      player.vx = 0;
      if (keys.left) { player.vx = -5; player.facing = -1; }
      if (keys.right) { player.vx = 5; player.facing = 1; }
      if (keys.jump && player.vy === 0) player.vy = -15;
      player.vy += 0.8; // gravity

      player.x += player.vx;
      player.y += player.vy;

      player.vx *= 0.9;
      player.vy *= 0.98;

      // Saldırı
      player.isAttacking = !!keys.attack;
      if (player.isAttacking) {
        this.state.players.forEach((other, otherId) => {
          if (otherId === id) return;
          const dist = Math.hypot(player.x - other.x, player.y - other.y);
          if (dist < 80) {
            other.damage += 10;
            other.vx += player.facing * (8 + other.damage / 20);
            other.vy -= 10;
          }
        });
      }

      // Düşme
      if (player.y > 600) {
        player.stock--;
        player.x = player.color === "#0000FF" ? 200 : 800;
        player.y = 100;
        player.damage = 0;
      }
    });
  }
}

const app = express();
const gameServer = new colyseus.Server({
  server: http.createServer(app)
});

gameServer.define("game", GameRoom);
gameServer.listen(2567);

console.log("Server çalışıyor: ws://localhost:2567");