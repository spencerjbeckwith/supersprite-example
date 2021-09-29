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
    /** Inverts this color. */
    invert() {
        return new Color(1 - this.red, 1 - this.green, 1 - this.blue, this.alpha);
    }
}
Color.fromHex = function (hex, alpha) {
    hex = hex.replace('#', '');
    if (hex.length !== 6) {
        throw new Error('Color.fromHex requires a six-digit hex color.');
    }
    return new Color(parseInt(hex[0] + hex[1], 16) / 255, parseInt(hex[2] + hex[3], 16) / 255, parseInt(hex[4] + hex[5], 16) / 255, alpha);
};
Color.toHex = function (col) {
    const r = Math.round(col.red * 255).toString(16);
    const g = Math.round(col.green * 255).toString(16);
    const b = Math.round(col.blue * 255).toString(16);
    return `#${r.length < 2 ? '0' : ''}${r}${g.length < 2 ? '0' : ''}${g}${b.length < 2 ? '0' : ''}${b}`;
};

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
        0, 2 / viewHeight, 0,
        -1, -1, 1
    ]);
};
Matrix.identity = [
    1, 0, 0,
    0, 1, 0,
    0, 0, 1
];

const defaultShaderOptions = {
    source: {
        vertex: `#version 300 es
in vec2 a_position;
in vec2 a_texcoord;
out vec2 v_texcoord;
uniform mat3 u_positionMatrix;
uniform mat3 u_textureMatrix;

void main() {
    gl_Position = vec4( (u_positionMatrix * vec3(a_position, 1.0) ).xy, 0, 1);
    v_texcoord = ( u_textureMatrix * vec3(a_texcoord, 1.0) ).xy;
}`,
        fragment: `#version 300 es
precision mediump float;
in vec2 v_texcoord;
out vec4 outputColor;
uniform sampler2D u_atlas;
uniform vec4 u_blend;

uniform int u_useTexture;

void main() {
    if (u_useTexture == 0) {
        outputColor = u_blend;
    } else {
        outputColor = texture(u_atlas, v_texcoord) * u_blend;
    }
}`,
    },
    attributes: {
        position: 'a_position',
        texture: 'a_texcoord',
    },
    uniforms: {
        positionMatrix: 'u_positionMatrix',
        textureMatrix: 'u_textureMatrix',
        atlas: 'u_atlas',
        blend: 'u_blend',
        useTexture: 'u_useTexture',
    },
};
/** Used internally to initialize the main shader */
function prepareMainShader(gl, options) {
    function createShader(type, source) {
        const shader = gl.createShader(type);
        if (!shader) {
            throw new Error(`Failed to create shader!`);
        }
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const err = gl.getShaderInfoLog(shader);
            gl.deleteShader(shader);
            throw new Error(`Failed to compile shader: ${err}`);
        }
        // Success!
        return shader;
    }
    const vertexShader = createShader(gl.VERTEX_SHADER, options ? options.source.vertex : defaultShaderOptions.source.vertex);
    const fragmentShader = createShader(gl.FRAGMENT_SHADER, options ? options.source.fragment : defaultShaderOptions.source.fragment);
    const shaderProgram = gl.createProgram();
    if (!shaderProgram) {
        throw new Error(`Failed to create WebGL program!`);
    }
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);
    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        throw new Error(`Failed to link shader program: ${gl.getProgramInfoLog(shaderProgram)}`);
    }
    const squareBuffer = gl.createBuffer();
    const positionBuffer = gl.createBuffer();
    const textureBuffer = gl.createBuffer();
    if (!squareBuffer || !positionBuffer || !textureBuffer) {
        throw new Error(`Failed to create required WebGL buffers!`);
    }
    const positionAttribute = gl.getAttribLocation(shaderProgram, options ? options.attributes.position : defaultShaderOptions.attributes.position);
    const textureAttribute = gl.getAttribLocation(shaderProgram, options ? options.attributes.texture : defaultShaderOptions.attributes.texture);
    const positionMatrixUniform = gl.getUniformLocation(shaderProgram, options ? options.uniforms.positionMatrix : defaultShaderOptions.uniforms.positionMatrix);
    if (!positionMatrixUniform) {
        throw new Error(`Failed to find position matrix uniform!`);
    }
    const textureMatrixUniform = gl.getUniformLocation(shaderProgram, options ? options.uniforms.textureMatrix : defaultShaderOptions.uniforms.textureMatrix);
    if (!textureMatrixUniform) {
        throw new Error(`Failed to find texture matrix uniform!`);
    }
    const atlasSamplerUniform = gl.getUniformLocation(shaderProgram, options ? options.uniforms.atlas : defaultShaderOptions.uniforms.atlas);
    if (!atlasSamplerUniform) {
        throw new Error(`Failed to find atlas sampler uniform!`);
    }
    const blendUniform = gl.getUniformLocation(shaderProgram, options ? options.uniforms.blend : defaultShaderOptions.uniforms.blend);
    if (!blendUniform) {
        throw new Error(`Failed to find blend uniform!`);
    }
    const useTextureUniform = gl.getUniformLocation(shaderProgram, options ? options.uniforms.useTexture : defaultShaderOptions.uniforms.useTexture);
    if (!useTextureUniform) {
        throw new Error(`Failed to find useTexture uniform!`);
    }
    gl.useProgram(shaderProgram);
    // Set up our default VAO
    const vao = gl.createVertexArray();
    if (!vao) {
        throw new Error(`Failed to create new vertex array!`);
    }
    gl.bindVertexArray(vao);
    // Load default unit quad into buffer
    const unitQuad = [0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0];
    gl.bindBuffer(gl.ARRAY_BUFFER, squareBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(unitQuad), gl.STATIC_DRAW);
    // Enable position and texture attributes for this VAO, which will use the square buffer
    gl.enableVertexAttribArray(positionAttribute);
    gl.vertexAttribPointer(positionAttribute, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(textureAttribute);
    gl.vertexAttribPointer(textureAttribute, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    return {
        vertex: vertexShader,
        fragment: fragmentShader,
        program: shaderProgram,
        vao: vao,
        buffers: {
            square: squareBuffer,
            position: positionBuffer,
            texture: textureBuffer,
        },
        attributes: {
            position: positionAttribute,
            texture: textureAttribute,
        },
        uniforms: {
            positionMatrix: positionMatrixUniform,
            textureMatrix: textureMatrixUniform,
            atlasSampler: atlasSamplerUniform,
            blend: blendUniform,
            useTexture: useTextureUniform,
        },
        createShader: createShader,
        setPositions: function (positions = unitQuad) {
            gl.enableVertexAttribArray(positionAttribute);
            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.DYNAMIC_DRAW);
            gl.vertexAttribPointer(positionAttribute, 2, gl.FLOAT, false, 0, 0);
        },
        setUVs: function (positions = unitQuad) {
            gl.enableVertexAttribArray(textureAttribute);
            gl.bindBuffer(gl.ARRAY_BUFFER, textureBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.DYNAMIC_DRAW);
            gl.vertexAttribPointer(textureAttribute, 2, gl.FLOAT, false, 0, 0);
        },
    };
}

/** Sets up references and methods, to be used internally */
function prepareDrawing(gl, ctx, main, projection, internalTimer) {
    // Utility methods
    function preparePrimitive(positions, color) {
        main.setPositions(positions);
        main.setUVs(positions);
        gl.uniformMatrix3fv(main.uniforms.positionMatrix, false, projection.values);
        gl.uniform1i(main.uniforms.useTexture, 0);
        if (color instanceof Color) {
            gl.uniform4f(main.uniforms.blend, color.red, color.green, color.blue, color.alpha);
        }
        else {
            gl.uniform4f(main.uniforms.blend, color[0] === undefined ? 1 : color[0], color[1] === undefined ? 1 : color[1], color[2] === undefined ? 1 : color[2], color[3] === undefined ? 1 : color[3]);
        }
    }
    function limitImage(sprite, image) {
        image = Math.floor(image);
        if (!sprite.images[image]) {
            image %= sprite.images.length;
        }
        return image;
    }
    function speedToImage(sprite, speed) {
        return (internalTimer.current * speed) % sprite.images.length;
    }
    // Methods defined outside of the returned object, because other draw methods depend on them
    function drawSprite(sprite, image, x, y, transform, color) {
        image = limitImage(sprite, image);
        // Set position matrix
        let mat = this.projection.copy().translate(x, y).scale(sprite.width, sprite.height);
        if (transform) {
            mat = transform(mat);
        }
        // Move by sprite's origin - do after transformations so its still relevant in clipspace
        if (sprite.originX !== 0 || sprite.originY !== 0) {
            mat.translate(-sprite.originX / sprite.width, -sprite.originY / sprite.height);
        }
        gl.bindTexture(gl.TEXTURE_2D, this.atlasTexture);
        gl.bindVertexArray(main.vao);
        gl.uniformMatrix3fv(main.uniforms.positionMatrix, false, mat.values);
        gl.uniformMatrix3fv(main.uniforms.textureMatrix, false, sprite.images[image].t);
        gl.uniform1i(main.uniforms.useTexture, 1);
        if (color instanceof Color) {
            gl.uniform4f(main.uniforms.blend, color.red, color.green, color.blue, color.alpha);
        }
        else if (color instanceof Array) {
            gl.uniform4f(main.uniforms.blend, color[0] === undefined ? 1 : color[0], color[1] === undefined ? 1 : color[1], color[2] === undefined ? 1 : color[2], color[3] === undefined ? 1 : color[3]);
        }
        else {
            gl.uniform4f(main.uniforms.blend, 1, 1, 1, 1);
        }
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.bindVertexArray(null);
    }
    function drawSpriteSpecial(sprite, image, x, y, positions, UVs, transform, color) {
        image = limitImage(sprite, image);
        // Set position matrix
        let mat = this.projection.copy().translate(x, y).scale(sprite.width, sprite.height);
        if (transform) {
            mat = transform(mat);
        }
        // Move by sprite's origin - do after transformations so its still relevant in clipspace
        if (sprite.originX !== 0 || sprite.originY !== 0) {
            mat.translate(-sprite.originX / sprite.width, -sprite.originY / sprite.height);
        }
        // Don't use the VAO
        gl.bindTexture(gl.TEXTURE_2D, this.atlasTexture);
        main.setPositions(positions);
        main.setUVs(UVs);
        gl.uniformMatrix3fv(main.uniforms.positionMatrix, false, mat.values);
        gl.uniformMatrix3fv(main.uniforms.textureMatrix, false, sprite.images[image].t);
        gl.uniform1i(main.uniforms.useTexture, 1);
        if (color instanceof Color) {
            gl.uniform4f(main.uniforms.blend, color.red, color.green, color.blue, color.alpha);
        }
        else if (color instanceof Array) {
            gl.uniform4f(main.uniforms.blend, color[0] === undefined ? 1 : color[0], color[1] === undefined ? 1 : color[1], color[2] === undefined ? 1 : color[2], color[3] === undefined ? 1 : color[3]);
        }
        else {
            gl.uniform4f(main.uniforms.blend, 1, 1, 1, 1);
        }
        gl.drawArrays(gl.TRIANGLES, 0, Math.floor(positions.length / 2));
    }
    function drawSpriteCtx(sprite, image, x, y, scaleX = 1, scaleY = 1) {
        if (this.atlasImage) {
            image = limitImage(sprite, image);
            const i = sprite.images[image];
            ctx.drawImage(this.atlasImage, i.x, i.y, sprite.width, sprite.height, x - sprite.originX, y - sprite.originY, sprite.width * scaleX, sprite.height * scaleY);
        }
    }
    function drawText(x, y, text, options) {
        ctx.textAlign = (options === null || options === void 0 ? void 0 : options.hAlign) || 'left';
        ctx.textBaseline = (options === null || options === void 0 ? void 0 : options.vAlign) || 'top';
        ctx.font = `${(options === null || options === void 0 ? void 0 : options.fontSize) || 10}px ${(options === null || options === void 0 ? void 0 : options.fontName) || 'sans-serif'}`;
        if (options === null || options === void 0 ? void 0 : options.drawShadow) {
            ctx.fillStyle = 'black';
            ctx.fillText(text, x + (options.shadowOffsetX === undefined ? 1 : options.shadowOffsetX), y + (options.shadowOffsetY === undefined ? 1 : options.shadowOffsetY), options.maxWidth);
        }
        ctx.fillStyle = (options === null || options === void 0 ? void 0 : options.color) || 'white';
        ctx.fillText(text, x, y, options === null || options === void 0 ? void 0 : options.maxWidth);
    }
    // And here's the actual return:
    return {
        atlasTexture: null,
        atlasImage: null,
        projection: projection,
        sprite: drawSprite,
        spriteSpecial: drawSpriteSpecial,
        spriteCtx: drawSpriteCtx,
        text: drawText,
        line: function (x, y, x2, y2, color) {
            preparePrimitive([x, y, x2, y2], color);
            gl.drawArrays(gl.LINES, 0, 2);
        },
        rect: function (x, y, x2, y2, color) {
            preparePrimitive([x, y, x, y2, x2, y2, x2, y2, x2, y, x, y], color);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        },
        circle: function (x, y, radius, segments, color) {
            const positions = [x, y];
            // Push each successive segment onto our positions
            let theta = 0;
            for (let i = 0; i <= segments; i++) {
                positions.push(x + (radius * Math.cos(theta)));
                positions.push(y + (radius * Math.sin(theta)));
                theta += Math.PI * 2 / segments;
            }
            preparePrimitive(positions, color);
            gl.drawArrays(gl.TRIANGLE_FAN, 0, segments + 2);
        },
        primitive: function (mode, positions, color) {
            let glEnum = gl.TRIANGLES;
            switch (mode) {
                case ('points'): {
                    glEnum = gl.POINTS;
                    break;
                }
                case ('lineStrip'): {
                    glEnum = gl.LINE_STRIP;
                    break;
                }
                case ('lineLoop'): {
                    glEnum = gl.LINE_LOOP;
                    break;
                }
                case ('lines'): {
                    glEnum = gl.LINES;
                    break;
                }
                case ('triangleStrip'): {
                    glEnum = gl.TRIANGLE_STRIP;
                    break;
                }
                case ('triangleFan'): {
                    glEnum = gl.TRIANGLE_FAN;
                    break;
                }
                case ('triangles'): {
                    glEnum = gl.TRIANGLES;
                    break;
                }
            }
            preparePrimitive(positions, color);
            gl.drawArrays(glEnum, 0, positions.length / 2);
        },
        spriteSpeed: function (spr, speed, x, y, transform, color) {
            drawSprite.bind(this)(spr, speedToImage(spr, speed), x, y, transform, color);
        },
        spriteSpeedSpecial: function (spr, speed, x, y, positions, UVs, transform, color) {
            drawSpriteSpecial.bind(this)(spr, speedToImage(spr, speed), x, y, positions, UVs, transform, color);
        },
        spriteSpeedCtx: function (spr, speed, x, y, scaleX = 1, scaleY = 1) {
            drawSpriteCtx.bind(this)(spr, speedToImage(spr, speed), x, y, scaleX, scaleY);
        },
        texture: function (texture, x, y, width, height, positions, UVs, transform, color) {
            gl.bindTexture(gl.TEXTURE_2D, texture);
            main.setPositions(positions);
            main.setUVs(UVs);
            let mat = this.projection.copy().translate(x, y).scale(width, height);
            if (transform) {
                mat = transform(mat);
            }
            gl.uniformMatrix3fv(main.uniforms.positionMatrix, false, mat.values);
            gl.uniformMatrix3fv(main.uniforms.textureMatrix, false, Matrix.identity);
            gl.uniform4f(main.uniforms.blend, 1, 1, 1, 1);
            gl.uniform1i(main.uniforms.useTexture, 1);
            if (color instanceof Color) {
                gl.uniform4f(main.uniforms.blend, color.red, color.green, color.blue, color.alpha);
            }
            else if (color instanceof Array) {
                gl.uniform4f(main.uniforms.blend, color[0] === undefined ? 1 : color[0], color[1] === undefined ? 1 : color[1], color[2] === undefined ? 1 : color[2], color[3] === undefined ? 1 : color[3]);
            }
            else {
                gl.uniform4f(main.uniforms.blend, 1, 1, 1, 1);
            }
            gl.drawArrays(gl.TRIANGLES, 0, positions.length / 2);
            gl.bindTexture(gl.TEXTURE_2D, this.atlasTexture);
        },
        textWrap: function (x, y, text, width, options) {
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
                else if (ctx.measureText(current).width > width && char.match((options === null || options === void 0 ? void 0 : options.lineBreakCharacters) || / |\/|\\|-/g)) {
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
            if ((options === null || options === void 0 ? void 0 : options.vAlign) === 'middle') {
                startY = y - ((lines.length - 1) * (options.lineSeparation || 16)) / 2;
            }
            else if ((options === null || options === void 0 ? void 0 : options.vAlign) === 'bottom') {
                startY = y - ((lines.length - 1) * (options.lineSeparation || 16));
            }
            // Draw each line
            for (let l = 0; l < lines.length; l++) {
                drawText(x, startY + (l * ((options === null || options === void 0 ? void 0 : options.lineSeparation) || 16)), lines[l], options);
            }
        },
    };
}

const defaultWidth = 400;
const defaultHeight = 240;
/** Initializes supersprite. This must be called before loading textures or drawing anything. */
function initialize(options) {
    // Create our canvases in DOM
    const cv1 = document.createElement('canvas');
    const cv2 = document.createElement('canvas');
    cv1.setAttribute('style', 'position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%); overflow: hidden;');
    cv2.setAttribute('style', 'position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%); overflow: hidden;');
    document.body.style.backgroundColor = '#000000';
    document.body.appendChild(cv1);
    document.body.appendChild(cv2);
    // Size canvases appropriately
    cv1.width = (options === null || options === void 0 ? void 0 : options.displayWidth) || (options === null || options === void 0 ? void 0 : options.viewWidth) || window.innerWidth;
    cv1.height = (options === null || options === void 0 ? void 0 : options.displayHeight) || (options === null || options === void 0 ? void 0 : options.viewHeight) || window.innerHeight;
    cv2.width = cv1.width;
    cv2.height = cv1.height;
    // Get contexts
    const gl = cv1.getContext('webgl2', options === null || options === void 0 ? void 0 : options.glOptions);
    if (!gl) {
        throw new Error('Failed to initialize WebGL context!');
    }
    const ctx = cv2.getContext('2d', options === null || options === void 0 ? void 0 : options.ctxOptions);
    if (!ctx) {
        throw new Error('Failed to initialize 2D canvas context!');
    }
    const main = prepareMainShader(gl, options === null || options === void 0 ? void 0 : options.mainShaderOptions);
    // Changes the string options into the appropriate GL enums
    function getGLParameter(str) {
        switch (str) {
            case ('linear'): {
                return gl === null || gl === void 0 ? void 0 : gl.LINEAR;
            }
            case ('nearest'): {
                return gl === null || gl === void 0 ? void 0 : gl.NEAREST;
            }
            case ('nearestMipmapNearest'): {
                return gl === null || gl === void 0 ? void 0 : gl.NEAREST_MIPMAP_NEAREST;
            }
            case ('linearMipmapNearest'): {
                return gl === null || gl === void 0 ? void 0 : gl.LINEAR_MIPMAP_NEAREST;
            }
            case ('nearestMipmapLinear'): {
                return gl === null || gl === void 0 ? void 0 : gl.NEAREST_MIPMAP_LINEAR;
            }
            case ('linearMipmapLinear'): {
                return gl === null || gl === void 0 ? void 0 : gl.LINEAR_MIPMAP_LINEAR;
            }
            case ('repeat'): {
                return gl === null || gl === void 0 ? void 0 : gl.REPEAT;
            }
            case ('clampToEdge'): {
                return gl === null || gl === void 0 ? void 0 : gl.CLAMP_TO_EDGE;
            }
            case ('mirroredRepeat'): {
                return gl === null || gl === void 0 ? void 0 : gl.MIRRORED_REPEAT;
            }
        }
    }
    // Set up gameTexture
    const gameTexture = gl.createTexture();
    if (!gameTexture) {
        throw new Error(`Failed to create gameTexture!`);
    }
    gl.bindTexture(gl.TEXTURE_2D, gameTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, defaultWidth, defaultHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    if (options === null || options === void 0 ? void 0 : options.gameTextureParameters) {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, getGLParameter(options.gameTextureParameters.textureMagFilter || 'linear') || gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, getGLParameter(options.gameTextureParameters.textureMinFilter || 'linear') || gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, getGLParameter(options.gameTextureParameters.textureWrapS || 'repeat') || gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, getGLParameter(options.gameTextureParameters.textureWrapT || 'repeat') || gl.REPEAT);
    }
    else {
        // Defaults
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    }
    // Used for rendering the gameTexture
    const gameTexturePositionMatrix = new Matrix([2, 0, 0, 0, -2, 0, -1, 1, 1]);
    const gameTextureTextureMatrix = new Matrix([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    // Set up framebuffer
    const framebuffer = gl.createFramebuffer();
    if (!framebuffer) {
        throw new Error(`Failed to create framebuffer!`);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, gameTexture, 0);
    // Initialize gl
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    const projection = Matrix.projection(400, 240);
    const internalTimer = { current: 0 };
    // Create return object
    const s = {
        // Elements
        cv1: cv1,
        cv2: cv2,
        atlasImage: null,
        // Contexts
        gl: gl,
        ctx: ctx,
        // For drawing
        main: main,
        gameTexture: gameTexture,
        atlasTexture: null,
        framebuffer: framebuffer,
        draw: prepareDrawing(gl, ctx, main, projection, internalTimer),
        // Initial view properties
        projection: projection,
        viewWidth: defaultWidth,
        viewHeight: defaultHeight,
        displayWidth: defaultWidth,
        displayHeight: defaultHeight,
        // Other
        internalTimer: internalTimer,
        background: {
            red: 0,
            green: 0,
            blue: 0,
        },
        blend: [1, 1, 1, 1],
        options: {
            responsive: (options === null || options === void 0 ? void 0 : options.responsive) ? options.responsive : 'scale',
            maintainAspectRatio: (options === null || options === void 0 ? void 0 : options.maintainAspectRatio) ? options.maintainAspectRatio : true,
            scalePerfectly: (options === null || options === void 0 ? void 0 : options.scalePerfectly) ? options.scalePerfectly : true,
            contextImageSmoothing: (options === null || options === void 0 ? void 0 : options.contextImageSmoothing) ? options.contextImageSmoothing : false,
            matchPageToBackground: (options === null || options === void 0 ? void 0 : options.matchPageToBackground) ? options.matchPageToBackground : false,
            enableCanvasResize: (options === null || options === void 0 ? void 0 : options.enableCanvasResize) ? options.enableCanvasResize : true,
        },
        // Methods
        setAtlas: function (atlasObject) {
            this.atlasTexture = atlasObject.texture;
            this.atlasImage = atlasObject.image;
            this.draw.atlasTexture = this.atlasTexture;
            this.draw.atlasImage = this.atlasImage;
            gl.uniform1i(main.uniforms.atlasSampler, 0);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.atlasTexture);
        },
        setProjection: function (viewWidth, viewHeight, displayWidth, displayHeight) {
            // Call anytime the view or display changes size
            this.viewWidth = viewWidth;
            this.viewHeight = viewHeight;
            this.displayWidth = displayWidth || viewWidth;
            this.displayHeight = displayHeight || viewHeight;
            this.projection = Matrix.projection(this.viewWidth, this.viewHeight);
            this.draw.projection = this.projection;
            // Resize canvases
            this.cv1.width = displayWidth || viewWidth;
            this.cv1.height = displayHeight || viewHeight;
            this.cv2.width = this.cv1.width;
            this.cv2.height = this.cv1.height;
            // Resize game texture
            gl.bindTexture(gl.TEXTURE_2D, this.gameTexture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.viewWidth, this.viewHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
            // Fix content
            ctx.imageSmoothingEnabled = this.options.contextImageSmoothing;
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(this.displayWidth / this.viewWidth, this.displayHeight / this.viewHeight);
        },
        beginRender: function () {
            // Call at the start of each frame
            if (this.options.matchPageToBackground) {
                document.body.style.backgroundColor = Color.toHex(new Color(this.background.red, this.background.green, this.background.blue));
            }
            // Draw to the framebuffer
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
            gl.viewport(0, 0, this.viewWidth, this.viewHeight);
            gl.clearColor(this.background.red, this.background.green, this.background.blue, 1);
            gl.clear(gl.COLOR_BUFFER_BIT);
            ctx.clearRect(0, 0, this.viewWidth, this.viewHeight);
            // Reset other properties
            if (this.atlasTexture) {
                gl.bindTexture(gl.TEXTURE_2D, this.atlasTexture);
            }
            gl.uniform4f(this.main.uniforms.blend, 1, 1, 1, 1);
            this.internalTimer.current++;
            if (this.internalTimer.current > 4096) {
                this.internalTimer.current = 0;
            }
        },
        endRender: function (transform, positions, UVs) {
            // Call at the end of each frame
            // Switch to correct framebuffer and texture
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.viewport(0, 0, this.displayWidth, this.displayHeight);
            gl.clearColor(0, 0, 0, 1);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.bindTexture(gl.TEXTURE_2D, this.gameTexture);
            // If arguments not provided, defaults to a unit quad
            main.setPositions(positions);
            main.setUVs(UVs);
            let mat = gameTexturePositionMatrix;
            if (transform) {
                mat = gameTexturePositionMatrix.copy();
                mat = transform(mat);
            }
            // Set uniforms
            gl.uniformMatrix3fv(main.uniforms.positionMatrix, false, mat.values);
            gl.uniformMatrix3fv(main.uniforms.textureMatrix, false, gameTextureTextureMatrix.values);
            if (this.blend instanceof Color) {
                gl.uniform4fv(main.uniforms.blend, [this.blend.red, this.blend.green, this.blend.blue, this.blend.alpha || 1]);
            }
            else {
                gl.uniform4fv(main.uniforms.blend, this.blend);
            }
            gl.uniform1i(main.uniforms.useTexture, 1);
            // Draw!
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        },
        loadTexture: function (url, texParameters) {
            return new Promise((resolve, reject) => {
                const tex = gl.createTexture();
                if (!tex) {
                    throw new Error(`Failed to create WebGLTexture!`);
                }
                gl.bindTexture(gl.TEXTURE_2D, tex);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, getGLParameter((texParameters === null || texParameters === void 0 ? void 0 : texParameters.textureMagFilter) || 'linear') || gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, getGLParameter((texParameters === null || texParameters === void 0 ? void 0 : texParameters.textureMinFilter) || 'linear') || gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, getGLParameter((texParameters === null || texParameters === void 0 ? void 0 : texParameters.textureWrapS) || 'repeat') || gl.REPEAT);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, getGLParameter((texParameters === null || texParameters === void 0 ? void 0 : texParameters.textureWrapT) || 'repeat') || gl.REPEAT);
                const image = new Image();
                image.src = url;
                image.addEventListener('load', () => {
                    gl.bindTexture(gl.TEXTURE_2D, tex);
                    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
                    resolve({
                        image: image,
                        texture: tex,
                        width: image.width,
                        height: image.height,
                    });
                });
                image.addEventListener('error', reject);
                image.addEventListener('abort', reject);
            });
        },
        resizeCanvas: function () {
            switch (this.options.responsive) {
                case ('stretch'): {
                    // Fill up all available space
                    if (this.options.maintainAspectRatio) {
                        const ratio = this.viewWidth / this.viewHeight;
                        let newWidth = this.viewWidth, newHeight = this.viewHeight;
                        if (window.innerWidth > window.innerHeight) {
                            newWidth = newHeight * ratio;
                            newHeight = window.innerHeight;
                        }
                        else {
                            newWidth = window.innerWidth;
                            newHeight = newWidth / ratio;
                        }
                        this.setProjection(newWidth, newHeight);
                    }
                    else {
                        this.setProjection(window.innerWidth, window.innerHeight);
                    }
                    break;
                }
                case ('scale'): {
                    // Stretch, but only to whole-pixel values
                    if (this.options.maintainAspectRatio) {
                        let scale = 1;
                        if (window.innerWidth > window.innerHeight) {
                            scale = window.innerHeight / this.viewHeight;
                        }
                        else {
                            scale = window.innerWidth / this.viewWidth;
                        }
                        scale = Math.max(scale, 1);
                        if (this.options.scalePerfectly) {
                            scale = Math.floor(scale);
                        }
                        this.setProjection(this.viewWidth, this.viewHeight, this.viewWidth * scale, this.viewHeight * scale);
                    }
                    else {
                        this.setProjection(this.viewWidth, this.viewHeight, window.innerWidth, window.innerHeight);
                    }
                    break;
                }
            }
        },
    };
    // Post-initialization adjustments
    s.ctx.imageSmoothingEnabled = s.options.contextImageSmoothing;
    s.setProjection((options === null || options === void 0 ? void 0 : options.viewWidth) || s.viewWidth, (options === null || options === void 0 ? void 0 : options.viewHeight) || s.viewHeight, options === null || options === void 0 ? void 0 : options.displayWidth, options === null || options === void 0 ? void 0 : options.displayHeight);
    if (s.options.enableCanvasResize) {
        window.addEventListener('resize', s.resizeCanvas.bind(s));
        window.addEventListener('orientation', s.resizeCanvas.bind(s));
        s.resizeCanvas();
    }
    return s;
}

let supersprite, draw;
/** Initializes supersprite and defines the "shader" and "draw" exports. This must be called before doing anything else with supersprite. */
function init(options) {
    supersprite = initialize(options);
    draw = supersprite.draw;
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
    supersprite.beginRender();

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

    supersprite.endRender();
    requestAnimationFrame(main);
}

init({
    responsive: 'scale',
    maintainAspectRatio: true,
    scalePerfectly: true,
    contextImageSmoothing: false,
    glOptions: {
        antialias: true,
    },
    gameTextureParameters: {
        textureMagFilter: 'nearest',
        textureMinFilter: 'nearest',
    }
});

supersprite.loadTexture('atlas.png',{
    textureMagFilter: 'nearest',
    textureMinFilter: 'nearest',
}).then((obj) => {
    supersprite.setAtlas(obj);
    supersprite.background = {
        red: 0.1,
        green: 0.05,
        blue: 0.05,
    };
    main();
});

// Game stuff
class Ball {
    constructor(x,y) {
        this.x = Math.random()*supersprite.viewWidth;
        this.y = 100+Math.random()*(supersprite.viewHeight/2);
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
        } else if (this.x+this.radius > supersprite.viewWidth) {
            this.x = supersprite.viewWidth-this.radius-1;
            this.hspeed = -this.hspeed;
        } else {
            this.x += this.hspeed;
        }

        if (this.y-this.radius < supersprite.viewHeight/2) {
            this.y = (supersprite.viewHeight/2)+this.radius+1;
            this.vspeed = -this.vspeed;
        } else if (this.y+this.radius > supersprite.viewHeight) {
            this.y = supersprite.viewHeight-this.radius-1;
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
