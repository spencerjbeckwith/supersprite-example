import { Color, draw, initialize, Shader } from 'supersprite';
import spr from './atlas.js';

const gameObjects = [];
const textOptions = {
    hAlign: 'center',
    vAlign: 'middle',
    drawShadow: true,
    fontSize: 14,
};
let n = 0;

function main() {
    Shader.beginRender();

    gameObjects.forEach(ball => ball.step());

    draw.text(200,32,'supersprite example',textOptions);

    draw.spriteSpeed(spr.mario,0.2,140,80);
    draw.spriteSpeed(spr.mario,0.2,260,80,m => m.scale(-1,1));

    let newScale = (Math.sin(n))+1.15;
    draw.sprite(spr.bowser,0,186,90,m => m.translate(0.5,0.5).rotate(n).scale(newScale,newScale).translate(-0.5,-0.5));

    n += Math.PI/60;
    if (n > Math.PI*2) {
        n -= Math.PI*2;
    }

    Shader.render();
    requestAnimationFrame(main);
}

initialize({
    mainLoop: main,
    atlasURL: 'atlas.png',
    responsive: 'scale',
    maintainAspectRatio: true,
    scalePerfectly: true,
    viewWidth: 400,
    viewHeight: 240,
    backgroundColor: {
        red: 0.1,
        green: 0.05,
        blue: 0.05,
    }
});

class Ball {
    constructor(x,y) {
        this.x = Math.random()*Shader.viewWidth;
        this.y = 100+Math.random()*(Shader.viewHeight/2);
        this.hspeed = (Math.random()*4)-2;
        this.vspeed = (Math.random()*4)-2;
        this.radius = Math.round((Math.random()*10)+10);

        this.color = new Color((Math.random()*0.75)+0.25,(Math.random()*0.75)+0.25,(Math.random()*0.75)+0.25);
        gameObjects.push(this);
    }

    step() {
        if (this.x-this.radius < 0) {
            this.x = this.radius+1;
            this.hspeed = -this.hspeed;
        } else if (this.x+this.radius > Shader.viewWidth) {
            this.x = Shader.viewWidth-this.radius-1;
            this.hspeed = -this.hspeed;
        } else {
            this.x += this.hspeed;
        }

        if (this.y-this.radius < Shader.viewHeight/2) {
            this.y = (Shader.viewHeight/2)+this.radius+1;
            this.vspeed = -this.vspeed;
        } else if (this.y+this.radius > Shader.viewHeight) {
            this.y = Shader.viewHeight-this.radius-1;
            this.vspeed = -this.vspeed;
        } else {
            this.y += this.vspeed;
        }

        draw.circle(this.x,this.y,this.radius,20,this.color);
    }
}

let count = 8;
while (count > 0) {
    new Ball();
    count--;
}