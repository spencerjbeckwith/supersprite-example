/**
 * Collection of four vectors that indicate the RGBA values of a color.
 */
class Color {
    /** Creates a new color from three or four vectors. Each must be between 0 and 1. */
    constructor(red, green, blue, alpha) {
        this.red = red;
        this.green = green;
        this.blue = blue;
        this.alpha = (alpha === undefined) ? 1 : alpha;
    }
    invert() {
        return new Color(1 - this.red, 1 - this.green, 1 - this.blue, this.alpha);
    }
}
Color.fromHex = function (hex, alpha) {
    hex = hex.replace('#', '');
    if (hex.length !== 6) {
        throw new ColorError('Color.fromHex requires a six-digit hex color.');
    }
    return new Color(parseInt(hex[0] + hex[1], 16) / 255, parseInt(hex[2] + hex[3], 16) / 255, parseInt(hex[4] + hex[5], 16) / 255, alpha);
};
class ColorError extends Error {
    constructor(message) {
        super(message);
    }
}

/** Allows for transformations by chaining different functions onto existing Matrices. */
class Matrix {
    constructor(values) {
        this.values = values;
    }
    copy() {
        return new Matrix([...this.values]);
    }
    /** Multiplies this matrix by another and returns itself, to allow multiple chained transformations. */
    multiply(mat) {
        const a00 = this.values[0 * 3 + 0];
        const a01 = this.values[0 * 3 + 1];
        const a02 = this.values[0 * 3 + 2];
        const a10 = this.values[1 * 3 + 0];
        const a11 = this.values[1 * 3 + 1];
        const a12 = this.values[1 * 3 + 2];
        const a20 = this.values[2 * 3 + 0];
        const a21 = this.values[2 * 3 + 1];
        const a22 = this.values[2 * 3 + 2];
        const b00 = mat.values[0 * 3 + 0];
        const b01 = mat.values[0 * 3 + 1];
        const b02 = mat.values[0 * 3 + 2];
        const b10 = mat.values[1 * 3 + 0];
        const b11 = mat.values[1 * 3 + 1];
        const b12 = mat.values[1 * 3 + 2];
        const b20 = mat.values[2 * 3 + 0];
        const b21 = mat.values[2 * 3 + 1];
        const b22 = mat.values[2 * 3 + 2];
        this.values = [
            b00 * a00 + b01 * a10 + b02 * a20,
            b00 * a01 + b01 * a11 + b02 * a21,
            b00 * a02 + b01 * a12 + b02 * a22,
            b10 * a00 + b11 * a10 + b12 * a20,
            b10 * a01 + b11 * a11 + b12 * a21,
            b10 * a02 + b11 * a12 + b12 * a22,
            b20 * a00 + b21 * a10 + b22 * a20,
            b20 * a01 + b21 * a11 + b22 * a21,
            b20 * a02 + b21 * a12 + b22 * a22,
        ];
        return this;
    }
    /** Translates this matrix and returns itself, to allow multiple chained transformations. Note that this does not translate the matrix by PIXELS, but by factors of the sprite's width and height. So, to translate one full sprite width to the right, you'd use "translate(1,0)" */
    translate(tx, ty) {
        return this.multiply(new Matrix([
            1, 0, 0,
            0, 1, 0,
            tx, ty, 1
        ]));
    }
    /** Rotates this matrix and returns itself, to allow multiple chained transformations. */
    rotate(radians) {
        const c = Math.cos(radians);
        const s = Math.sin(radians);
        return this.multiply(new Matrix([
            c, -s, 0,
            s, c, 0,
            0, 0, 1
        ]));
    }
    /** Scales this matrix and returns itself, to allow multiple chained transformations. */
    scale(sx, sy) {
        return this.multiply(new Matrix([
            sx, 0, 0,
            0, sy, 0,
            0, 0, 1
        ]));
    }
}
Matrix.projection = function (viewWidth, viewHeight) {
    return new Matrix([
        2 / viewWidth, 0, 0,
        0, -2 / viewHeight, 0,
        -1, 1, 1
    ]);
};
Matrix.identity = [
    1, 0, 0,
    0, 1, 0,
    0, 0, 1
];

/** A class for shader programs used by supersprite, which contains a lot of static properties and methods to control supersprite's drawing behavior. */
class Shader {
    /** Creates a new Shader instance with a new shader program. */
    constructor(opt) {
        const gl = Shader.gl;
        const vertexShader = Shader.createShader(gl.VERTEX_SHADER, opt.vertexSource);
        const fragmentShader = Shader.createShader(gl.FRAGMENT_SHADER, opt.fragmentSource);
        const program = gl.createProgram();
        if (!program) {
            throw new ShaderError('Failed to create program!');
        }
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const err = gl.getProgramInfoLog(program);
            gl.deleteProgram(program);
            throw new ShaderError(`Failed to link shader program: ${err}`);
        }
        // Link success, now get attributes and uniforms
        this.program = program;
        let tempAttribute = gl.getAttribLocation(program, opt.names.positionAttribute);
        if (tempAttribute === -1) {
            throw new ShaderError(`Position attribute "${opt.names.positionAttribute}" not found in shader program.`);
        }
        this.positionAttribute = tempAttribute;
        let tempUniform = gl.getUniformLocation(program, opt.names.positionUniform);
        if (!tempUniform) {
            throw new ShaderError(`Position matrix uniform "${opt.names.positionUniform}" not found in shader program.`);
        }
        this.positionMatrix = tempUniform;
        tempUniform = gl.getUniformLocation(program, opt.names.blendUniform);
        if (!tempUniform) {
            throw new ShaderError(`Blend uniform "${opt.names.blendUniform}" not found in shader program.`);
        }
        this.blendUniform = tempUniform;
        // Only set up texture stuff for image shaders
        if (opt.useTexture) {
            tempAttribute = gl.getAttribLocation(program, opt.names.textureAttribute || '');
            if (tempAttribute === -1) {
                throw new ShaderError(`Texture attribute "${opt.names.textureAttribute}" not found in shader program.`);
            }
            this.textureAttribute = tempAttribute;
            tempUniform = gl.getUniformLocation(program, opt.names.textureUniform || '');
            if (!tempUniform) {
                throw new ShaderError(`Texture matrix uniform "${opt.names.textureUniform}" not found in shader program.`);
            }
            this.textureMatrix = tempUniform;
        }
        // Found all our attributes/uniforms, now put data into each attribute
        const buffer = gl.createBuffer();
        if (!buffer) {
            throw new ShaderError(`Failed to create buffer.`);
        }
        this.buffer = buffer;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        if (opt.useTexture) {
            gl.bufferData(gl.ARRAY_BUFFER, Shader.positionOrder, gl.STATIC_DRAW);
        }
        else {
            gl.bufferData(gl.ARRAY_BUFFER, Shader.triangleOrder, gl.DYNAMIC_DRAW);
        }
        gl.enableVertexAttribArray(this.positionAttribute);
        gl.vertexAttribPointer(this.positionAttribute, 2, gl.FLOAT, false, 0, 0);
        if (this.textureAttribute) {
            gl.enableVertexAttribArray(this.textureAttribute);
            gl.vertexAttribPointer(this.textureAttribute, 2, gl.FLOAT, false, 0, 0);
        }
    }
    /** Sets this current Shader instance as the current program to use when drawing. */
    use(positions = Shader.positionOrder) {
        // Set our position attribute to whatever is provided (primitives) or default positions (images)
        const gl = Shader.gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
        gl.vertexAttribPointer(this.positionAttribute, 2, gl.FLOAT, false, 0, 0);
        // Update used program
        if (Shader.currentProgram !== this) {
            Shader.currentProgram = this;
            gl.useProgram(this.program);
        }
    }
}
Shader.createShader = function (type, source) {
    // Don't call - this is called by the Shader constructor when you init
    const gl = Shader.gl;
    const shader = gl.createShader(type);
    if (!shader) {
        throw new ShaderError(`Failed to create shader!`);
    }
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const err = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new ShaderError(`Failed to compile shader: ${err}`);
    }
    // Success!
    return shader;
};
Shader.init = function (gl, ctx, viewWidth, viewHeight, displayWidth, displayHeight, imageOptions, primitiveOptions, positionOrder = new Float32Array([0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0,]), triangleOrder = new Float32Array([0, 0, 0.5, 0.5])) {
    // Call before your animation loop begins
    this.positionOrder = positionOrder;
    this.triangleOrder = triangleOrder;
    this.currentProgram = null;
    this.internalTimer = 0;
    this.gl = gl;
    this.ctx = ctx;
    this.imageShader = new Shader(imageOptions || {
        // Default image shader
        vertexSource: 'attribute vec2 a_position;\n' +
            'attribute vec2 a_texcoord;\n' +
            'uniform mat3 u_positionMatrix;\n' +
            'uniform mat3 u_texcoordMatrix;\n' +
            'varying vec2 v_texcoord;\n' +
            'void main() {\n' +
            '    gl_Position = vec4((u_positionMatrix*vec3(a_position,1)).xy,0,1);\n' +
            '    v_texcoord = (u_texcoordMatrix*vec3(a_texcoord,1.0)).xy;\n' +
            '}',
        fragmentSource: 'precision mediump float;\n' +
            'uniform sampler2D u_image;\n' +
            'uniform vec4 u_blend;\n' +
            'varying vec2 v_texcoord;\n' +
            'void main() {\n' +
            '    gl_FragColor = texture2D(u_image,v_texcoord)*u_blend;\n' +
            '}',
        useTexture: true,
        names: {
            positionAttribute: 'a_position',
            positionUniform: 'u_positionMatrix',
            blendUniform: 'u_blend',
            textureAttribute: 'a_texcoord',
            textureUniform: 'u_texcoordMatrix',
        }
    });
    this.primitiveShader = new Shader(primitiveOptions || {
        // Default primitive shader
        vertexSource: 'attribute vec2 a_position;\n' +
            'uniform mat3 u_positionMatrix;\n' +
            'void main() {\n' +
            '    gl_Position = vec4((u_positionMatrix*vec3(a_position,1)).xy,0,1);\n' +
            '}',
        fragmentSource: 'precision mediump float;\n' +
            'uniform vec4 u_blend;\n' +
            'void main() {\n' +
            '    gl_FragColor = u_blend;\n' +
            '}',
        useTexture: false,
        names: {
            positionAttribute: 'a_position',
            positionUniform: 'u_positionMatrix',
            blendUniform: 'u_blend',
            textureAttribute: 'a_texcoord',
        }
    });
    // Init gl
    ctx.imageSmoothingEnabled = this.contextImageSmoothing || false;
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    // Set up game texture
    const tex = gl.createTexture();
    if (!tex) {
        throw new ShaderError(`Failed to create rendering target WebGLTexture!`);
    }
    this.gameTexture = tex;
    this.setProjection(viewWidth, viewHeight, displayWidth, displayHeight); // also binds game texture
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.gameTexturePositionMatrix = [2, 0, 0, 0, -2, 0, -1, 1, 1];
    this.gameTextureIdentityMatrix = [1, 0, 0, 0, -1, 0, 0, 1, 1];
    this.gameTextureBlend = new Color(1, 1, 1);
    const fb = gl.createFramebuffer();
    if (!fb) {
        throw new ShaderError(`Failed to create FrameBuffer!`);
    }
    this.frameBuffer = fb;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.frameBuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.gameTexture, 0);
};
Shader.beginRender = function () {
    // Call at the start of each frame
    const gl = this.gl;
    const ctx = this.ctx;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.frameBuffer);
    gl.viewport(0, 0, this.viewWidth, this.viewHeight);
    gl.clearColor(this.backgroundColor.red, this.backgroundColor.green, this.backgroundColor.blue, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    ctx.clearRect(0, 0, this.viewWidth, this.viewHeight);
    ctx.save();
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTexture);
    this.imageShader.use();
    gl.uniform4f(this.imageShader.blendUniform, 1, 1, 1, 1);
    this.internalTimer++;
    if (this.internalTimer > 4096) {
        this.internalTimer = 0;
    }
};
Shader.render = function () {
    // Call at the end of each frame
    // Switch to right framebuffer and texture
    const gl = this.gl;
    const ctx = this.ctx;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.displayWidth, this.displayHeight);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindTexture(gl.TEXTURE_2D, this.gameTexture);
    // the view width/height is the game surface
    // the display width/height is the canvas
    // the view will be stretched to fill the display. If they arent the same size, the view will be stretched to fit.
    // Update bound buffer to correct type
    this.imageShader.use();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.imageShader.buffer);
    gl.enableVertexAttribArray(this.imageShader.positionAttribute);
    gl.vertexAttribPointer(this.imageShader.positionAttribute, 2, gl.FLOAT, false, 0, 0);
    // Update uniforms w/ precalculated display matrices, and finally draw
    gl.uniformMatrix3fv(this.imageShader.positionMatrix, false, this.gameTexturePositionMatrix);
    if (this.imageShader.textureMatrix) {
        gl.uniformMatrix3fv(this.imageShader.textureMatrix, false, this.gameTextureIdentityMatrix);
    }
    let cols = [];
    if (this.gameTextureBlend instanceof Color) {
        cols = [this.gameTextureBlend.red, this.gameTextureBlend.green, this.gameTextureBlend.blue, this.gameTextureBlend.alpha];
    }
    else {
        cols = this.gameTextureBlend;
    }
    gl.uniform4fv(this.imageShader.blendUniform, cols);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    ctx.restore();
};
Shader.loadAtlasTexture = function (url) {
    const gl = this.gl;
    return new Promise((resolve, reject) => {
        const tex = gl.createTexture();
        if (!tex) {
            throw new ShaderError(`Failed to create atlas WebGLTexture!`);
        }
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        const image = new Image();
        image.src = url;
        image.addEventListener('load', () => {
            Shader.atlasImage = image;
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
            resolve(tex);
        });
        image.addEventListener('error', reject);
        image.addEventListener('abort', reject);
    });
};
Shader.setProjection = function (viewWidth, viewHeight, displayWidth, displayHeight) {
    const gl = this.gl;
    this.viewWidth = viewWidth;
    this.viewHeight = viewHeight;
    this.displayWidth = displayWidth || viewWidth;
    this.displayHeight = displayHeight || viewHeight;
    this.projection = Matrix.projection(this.viewWidth, this.viewHeight);
    // Initialize primitive shader w/ new position uniforms.
    this.primitiveShader.use();
    gl.uniformMatrix3fv(this.primitiveShader.positionMatrix, false, this.projection.values);
    // Resize canvases
    this.cv1.width = displayWidth || viewWidth;
    this.cv1.height = displayHeight || viewHeight;
    this.cv2.width = this.cv1.width;
    this.cv2.height = this.cv1.height;
    // Resize texture
    gl.bindTexture(gl.TEXTURE_2D, this.gameTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.viewWidth, this.viewHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    // Fix context
    this.ctx.imageSmoothingEnabled = this.contextImageSmoothing;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(this.displayWidth / this.viewWidth, this.displayHeight / this.viewHeight);
};
Shader.setBackgroundColor = function (red, green, blue) {
    this.backgroundColor = {
        red: red,
        green: green,
        blue: blue,
    };
};
class ShaderError extends Error {
    constructor(message) {
        super(message);
    }
}

function drawLine(x, y, x2, y2, rcol, g, b, a) {
    const positions = [x, y, x2, y2];
    preparePrimitive(positions, rcol, g, b, a);
    Shader.gl.drawArrays(Shader.gl.LINES, 0, 2);
}
function drawRect(x, y, x2, y2, rcol, g, b, a) {
    const positions = [
        x, y2, x, y, x2, y,
        x2, y, x2, y2, x, y2,
    ];
    preparePrimitive(positions, rcol, g, b, a);
    Shader.gl.drawArrays(Shader.gl.TRIANGLES, 0, 6);
}
function drawCircle(x, y, radius, segments, rcol, g, b, a) {
    const positions = [x, y];
    // Push each successive segment onto position attribute
    let theta = 0;
    for (let i = 0; i <= segments; i++) {
        positions.push(x + (radius * Math.cos(theta)));
        positions.push(y + (radius * Math.sin(theta)));
        theta += Math.PI * 2 / segments;
    }
    preparePrimitive(positions, rcol, g, b, a);
    Shader.gl.drawArrays(Shader.gl.TRIANGLE_FAN, 0, segments + 2);
}
function drawPrimitive(mode, positions, rcol, g, b, a) {
    preparePrimitive(positions, rcol, g, b, a);
    Shader.gl.drawArrays(mode, 0, positions.length / 2);
}
function drawSprite(sprite, image, x, y, transformFn, rcol, g, b, a) {
    Shader.imageShader.use();
    // Limit our image
    image = Math.floor(image);
    if (!sprite.images[image]) {
        image %= sprite.images.length;
    }
    // Set position matrix
    let mat = Shader.projection.copy().translate(x, y).scale(sprite.width, sprite.height);
    // Chain more transformations here!
    if (transformFn) {
        mat = transformFn(mat);
    }
    // Move by sprite's origin - do after transformations so its still relevant in clipspace
    if (sprite.originX !== 0 || sprite.originY !== 0) {
        mat.translate(-sprite.originX / sprite.width, -sprite.originY / sprite.height);
    }
    Shader.gl.uniformMatrix3fv(Shader.imageShader.positionMatrix, false, mat.values);
    Shader.gl.uniformMatrix3fv(Shader.imageShader.textureMatrix || null, false, sprite.images[image].t);
    if (rcol instanceof Color) {
        Shader.gl.uniform4f(Shader.imageShader.blendUniform, rcol.red, rcol.green, rcol.blue, rcol.alpha);
    }
    else if (rcol !== undefined && g !== undefined && b !== undefined) {
        Shader.gl.uniform4f(Shader.imageShader.blendUniform, rcol, g, b, (a === undefined) ? 1 : a);
    }
    else {
        Shader.gl.uniform4f(Shader.imageShader.blendUniform, 1, 1, 1, 1);
    }
    Shader.gl.drawArrays(Shader.gl.TRIANGLES, 0, 6);
}
function drawSpriteSpeed(sprite, speed, x, y, transformFn, rcol, g, b, a) {
    if (rcol instanceof Color) {
        drawSprite(sprite, (Shader.internalTimer * speed) % sprite.images.length, x, y, transformFn || null, rcol);
    }
    else if (rcol && g && b) {
        drawSprite(sprite, (Shader.internalTimer * speed) % sprite.images.length, x, y, transformFn || null, rcol, g, b, a);
    }
    else if (transformFn) {
        drawSprite(sprite, (Shader.internalTimer * speed) % sprite.images.length, x, y, transformFn);
    }
    else {
        drawSprite(sprite, (Shader.internalTimer * speed) % sprite.images.length, x, y);
    }
}
/**
 * Draws a sprite on the 2D context. Blending and transformations past scaling are not possible, and the sprite will appear above all regular GL drawing.
 * @param sprite Sprite resource as output by supersprite's atlas compiler
 * @param image Index of the image to draw from the sprite. Images begin at 0. Values past the total number will wrap back around to an existing image.
 * @param x X coordinate to place the sprite's origin
 * @param y Y coordinate to place the sprite's origin
 * @param scaleX Optional scale factor to apply to the sprite horizontally
 * @param scaleY Optional scale factor to apply to the sprite vertically
 */
function drawSpriteCtx(sprite, image, x, y, scaleX = 1, scaleY = 1) {
    image = Math.floor(image);
    if (!sprite.images[image]) {
        image %= sprite.images.length;
    }
    const i = sprite.images[image];
    Shader.ctx.drawImage(Shader.atlasImage, i.x - sprite.originX, i.y - sprite.originY, sprite.width, sprite.height, x, y, sprite.width * scaleX, sprite.height * scaleY);
}
/**
 * Draws an animated sprite on the 2D context. Blending and transformations past scaling are not possible, and the sprite will appear above all regular GL drawing.
 * @param sprite Sprite resource as output by supersprite's atlas compiler
 * @param speed Number of frames per second to animate the sprite. Should be less than 1.
 * @param x X coordinate to place the sprite's origin
 * @param y Y coordinate to place the sprite's origin
 * @param scaleX Optional scale factor to apply to the sprite horizontally
 * @param scaleY Optional scale factor to apply to the sprite vertically
 */
function drawSpriteSpeedCtx(sprite, speed, x, y, scaleX = 1, scaleY = 1) {
    drawSpriteCtx(sprite, (Shader.internalTimer * speed) % sprite.images.length, x, y, scaleX, scaleY);
}
/**
 * Draws a line of text on the 2D context.
 * @param x X coordinate to place the text at
 * @param y Y coordinate to place the text at
 * @param text The text string to draw
 * @param opt Optional options to control aspects of the drawing, such as alignment, color and font. Defaults to white 10px sans-serif aligned top-left.
 */
function drawText(x, y, text, opt) {
    const ctx = Shader.ctx;
    ctx.textAlign = (opt === null || opt === void 0 ? void 0 : opt.hAlign) || 'left';
    ctx.textBaseline = (opt === null || opt === void 0 ? void 0 : opt.vAlign) || 'top';
    ctx.font = `${(opt === null || opt === void 0 ? void 0 : opt.fontSize) || 10}px ${(opt === null || opt === void 0 ? void 0 : opt.fontName) || 'sans-serif'}`;
    if (opt === null || opt === void 0 ? void 0 : opt.drawShadow) {
        ctx.fillStyle = 'black';
        ctx.fillText(text, x + (opt.shadowOffsetX === undefined ? 1 : opt.shadowOffsetX), y + (opt.shadowOffsetY === undefined ? 1 : opt.shadowOffsetY), opt.maxWidth);
    }
    ctx.fillStyle = (opt === null || opt === void 0 ? void 0 : opt.color) || 'white';
    ctx.fillText(text, x, y, opt === null || opt === void 0 ? void 0 : opt.maxWidth);
}
/**
 * Draws text on the 2D context, constrained to fit in a certain space. Exceeding the provided width will allow the text to break onto multiple lines.
 * @param x X coordinate to place the text at
 * @param y Y coordinate to place the test at
 * @param text The text string to draw
 * @param width The width (in pixels) that, once exceeded, the text should break
 * @param opt Optional options to control aspects of the drawing, such as alignment, color, and font. Defaults to white 10px sans-serif aligned top-left.
 */
function drawTextWrap(x, y, text, width, opt) {
    const ctx = Shader.ctx;
    const lines = [];
    let position = 0, lineIndex = 0, current = '';
    // Figure out the text for each line
    while (position <= text.length) {
        const char = text.charAt(position);
        if (char === '') {
            // End of text
            lines[lineIndex] = current;
            break;
        }
        else if (ctx.measureText(current).width > width && char.match((opt === null || opt === void 0 ? void 0 : opt.lineBreakCharacters) || / |\/|\\|-/g)) {
            if (char !== ' ') {
                current += char; // Include all characters but spaces
            }
            // Reset to write the next line
            lines[lineIndex] = current;
            lineIndex++;
            current = '';
        }
        else {
            // Not a breaking character, or not wide enough yet
            current += char;
        }
        position++;
    }
    // Figure out where to actually draw, based on our vertical alignment
    let startY = y;
    if ((opt === null || opt === void 0 ? void 0 : opt.vAlign) === 'middle') {
        startY = y - ((lines.length - 1) * (opt.lineSeparation || 16)) / 2;
    }
    else if ((opt === null || opt === void 0 ? void 0 : opt.vAlign) === 'bottom') {
        startY = y - ((lines.length - 1) * (opt.lineSeparation || 16));
    }
    // Draw each line
    for (let l = 0; l < lines.length; l++) {
        drawText(x, startY + (l * ((opt === null || opt === void 0 ? void 0 : opt.lineSeparation) || 16)), lines[l], opt);
    }
}
function preparePrimitive(positions, rcol, g, b, a) {
    Shader.primitiveShader.use(new Float32Array(positions));
    if (rcol instanceof Color) {
        Shader.gl.uniform4f(Shader.primitiveShader.blendUniform, rcol.red, rcol.green, rcol.blue, rcol.alpha);
    }
    else if (g !== undefined && b !== undefined) {
        Shader.gl.uniform4f(Shader.primitiveShader.blendUniform, rcol, g, b, (a === undefined) ? 1 : a);
    }
    else {
        throw new DrawError(`Illegal color arguments! R: ${rcol}, G: ${g}, B: ${b}, A: ${a}`);
    }
}
class DrawError extends Error {
    constructor(message) {
        super(message);
    }
}
var draw = {
    line: drawLine,
    rect: drawRect,
    circle: drawCircle,
    primitive: drawPrimitive,
    sprite: drawSprite,
    spriteSpeed: drawSpriteSpeed,
    spriteCtx: drawSpriteCtx,
    spriteSpeedCtx: drawSpriteSpeedCtx,
    text: drawText,
    textWrap: drawTextWrap,
};

/** Initialize supersprite by creating the canvases, setting up the GL and 2D contexts, and loading the atlas texture. */
function initialize(options) {
    // Create and style our canvases
    const cv1 = document.createElement('canvas');
    const cv2 = document.createElement('canvas');
    document.body.appendChild(cv1);
    document.body.appendChild(cv2);
    cv1.width = options.displayWidth || options.viewWidth || window.innerWidth;
    cv1.height = options.displayHeight || options.viewHeight || window.innerHeight;
    cv2.width = cv1.width;
    cv2.height = cv1.height;
    cv1.setAttribute('style', 'position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%); overflow: hidden;');
    cv2.setAttribute('style', 'position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%); overflow: hidden;');
    // Get our contexts
    const gl = cv1.getContext('webgl', {
        antialias: options.glAntialias || false,
    });
    if (!gl) {
        throw new Error('Failed to initialize WebGL context!');
    }
    const ctx = cv2.getContext('2d');
    if (!ctx) {
        throw new Error('Failed to initialize 2D canvas context!');
    }
    // Initialize Shader:
    // Draw options
    Shader.cv1 = cv1;
    Shader.cv2 = cv2;
    if (options.backgroundColor) {
        Shader.setBackgroundColor(options.backgroundColor.red, options.backgroundColor.green, options.backgroundColor.blue);
    }
    else {
        Shader.setBackgroundColor(0, 0, 0);
    }
    Shader.responsive = options.responsive || 'static';
    Shader.maintainAspectRatio = options.maintainAspectRatio;
    Shader.scalePerfectly = options.scalePerfectly;
    Shader.contextImageSmoothing = options.contextImageSmoothing || false;
    // GL
    Shader.init(gl, ctx, options.viewWidth || window.innerWidth, options.viewHeight || window.innerHeight, options.displayWidth, options.displayHeight, options.imageShader, options.primitiveShader, options.positionOrder, options.triangleOrder);
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('orientationchange', resizeCanvas);
    resizeCanvas();
    if (options.atlasURL) {
        // Texture
        Shader.loadAtlasTexture(options.atlasURL).then((tex) => {
            Shader.atlasTexture = tex;
            options.mainLoop();
        }).catch((err) => {
            console.error('Failed to load atlas texture!');
            console.error(err);
        });
    }
    else {
        // No textures
        options.mainLoop();
    }
}
/** Refreshes the size of the canvas according to the current size of the window and supersprite's responsive, maintainAspectRatio, and scalePerfectly options. */
function resizeCanvas() {
    switch (Shader.responsive) {
        case ('stretch'): {
            if (Shader.maintainAspectRatio) {
                const ratio = Shader.viewWidth / Shader.viewHeight;
                let newWidth = Shader.viewWidth, newHeight = Shader.viewHeight;
                if (window.innerWidth > window.innerHeight) {
                    newHeight = window.innerHeight;
                    newWidth = newHeight * ratio;
                }
                else {
                    newWidth = window.innerWidth;
                    newHeight = newWidth / ratio;
                }
                Shader.setProjection(newWidth, newHeight);
            }
            else {
                Shader.setProjection(window.innerWidth, window.innerHeight);
            }
            break;
        }
        case ('scale'): {
            if (Shader.maintainAspectRatio) {
                let scale = 1;
                if (window.innerHeight > window.innerWidth) {
                    scale = window.innerWidth / Shader.viewWidth;
                }
                else {
                    scale = window.innerHeight / Shader.viewHeight;
                }
                scale = Math.max(scale, 1);
                if (Shader.scalePerfectly) {
                    scale = Math.floor(scale);
                }
                Shader.setProjection(Shader.viewWidth, Shader.viewHeight, Shader.viewWidth * scale, Shader.viewHeight * scale);
            }
            else {
                Shader.setProjection(Shader.viewWidth, Shader.viewHeight, window.innerWidth, window.innerHeight);
            }
            break;
        }
    }
}

var spr = {"bowser":{"width":28,"height":42,"originX":0,"originY":0,"images":[{"x":0,"y":0,"t":[0.0546875,0,0,0,0.08203125,0,0,0,1]}]},"mario":{"width":16,"height":32,"originX":8,"originY":0,"images":[{"x":32,"y":0,"t":[0.03125,0,0,0,0.0625,0,0.0625,0,1]},{"x":64,"y":0,"t":[0.03125,0,0,0,0.0625,0,0.125,0,1]},{"x":96,"y":0,"t":[0.03125,0,0,0,0.0625,0,0.1875,0,1]},{"x":128,"y":0,"t":[0.03125,0,0,0,0.0625,0,0.25,0,1]}]}};

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
    draw.spriteSpeed(spr.mario,0.2,260,80,mat => mat.scale(-1,1));

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
