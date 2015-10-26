(function() {
    'use strict';
    // deferredSetup.js must be loaded first

    R.deferredRender = function(state) {
        if (!aborted && (
            !R.progCopy ||
            !R.progRed ||
            !R.progClear ||
            !R.prog_Ambient ||
            !R.prog_BlinnPhong_PointLight ||
            !R.prog_Debug ||
            !R.progPost1)) {
            console.log('waiting for programs to load...');
            return;
        }

        // Move the R.lights
        for (var i = 0; i < R.lights.length; i++) {
            // OPTIONAL TODO: Edit if you want to change how lights move
            var mn = R.light_min[1];
            var mx = R.light_max[1];
            R.lights[i].pos[1] = (R.lights[i].pos[1] + R.light_dt - mn + mx) % mx + mn;
        }

        // Execute deferred shading pipeline

        // CHECKITOUT: START HERE! You can even uncomment this:
        //debugger;

        R.pass_copy.render(state);

        if (cfg && cfg.debugView >= 0) {
            // Do a debug render instead of a regular render
            // Don't do any post-processing in debug mode
            R.pass_debug.render(state);
        } else {
            // * Deferred pass and postprocessing pass(es)
            // TO+DO: uncomment these
            if(cfg.tiled) R.pass_tiled.render(state);
            else R.pass_tiled.render(state);
            R.pass_post1.render(state);

            // OPTIONAL TODO: call more postprocessing passes, if any
        }
    };

    /**
     * 'copy' pass: Render into g-buffers
     */
    R.pass_copy.render = function(state) {
        // * Bind the framebuffer R.pass_copy.fbo
        // TO+DO: ^
        gl.bindFramebuffer(gl.FRAMEBUFFER, R.pass_copy.fbo);

        // * Clear screen using R.progClear
        TODO: renderFullScreenQuad(R.progClear);
        // * Clear depth buffer to value 1.0 using gl.clearDepth and gl.clear
        // TO+DO: ^
        gl.clearDepth(1.0);
        gl.clear(gl.DEPTH_BUFFER_BIT);

        // * "Use" the program R.progCopy.prog
        // TO+DO: ^
        // TO+DO: Write glsl/copy.frag.glsl
        gl.useProgram(R.progCopy.prog);


        var m = state.cameraMat.elements;
        // * Upload the camera matrix m to the uniform R.progCopy.u_cameraMat
        //   using gl.uniformMatrix4fv
        // TO+DO: ^
        gl.uniformMatrix4fv(R.progCopy.u_cameraMat,gl.FALSE,m);

        // * Draw the scene
        drawScene(state);
    };

    var drawScene = function(state) {
        for (var i = 0; i < state.models.length; i++) {
            var m = state.models[i];

            // If you want to render one model many times, note:
            // readyModelForDraw only needs to be called once.
            readyModelForDraw(R.progCopy, m);

            drawReadyModel(m);
        }
    };

    R.pass_debug.render = function(state) {
        // * Unbind any framebuffer, so we can write to the screen
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        // * Bind/setup the debug "lighting" pass
        // * Tell shader which debug view to use
        bindTexturesForLightPass(R.prog_Debug);
        gl.uniform1i(R.prog_Debug.u_debug, cfg.debugView);

        // * Render a fullscreen quad to perform shading on
        renderFullScreenQuad(R.prog_Debug);
    };

    /**
     * 'deferred' pass: Add lighting results for each individual light
     */
    R.pass_deferred.render = function(state) {
        // * Bind R.pass_deferred.fbo to write into for later postprocessing
        gl.bindFramebuffer(gl.FRAMEBUFFER, R.pass_deferred.fbo);

        // * Clear depth to 1.0 and color to black
        gl.clearColor(0.0, 0.0, 0.0, 0.0);
        gl.clearDepth(1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);



        // Enable blending and use gl.blendFunc to blend with:
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);

        // * Bind/setup the ambient pass, and render using fullscreen quad
        bindTexturesForLightPass(R.prog_Ambient);
        gl.uniform3f(R.prog_Ambient.u_ambo, cfg.ambient[0],cfg.ambient[1],cfg.ambient[2]);
        renderFullScreenQuad(R.prog_Ambient);

        bindTexturesForLightPass(R.prog_BlinnPhong_PointLight);

        gl.enable(gl.SCISSOR_TEST);
        var tlight = R.lights.length;
        if(cfg.oneLight) {tlight = 1;}
        for(var i = 0; i < tlight; i++) {
          var light = R.lights[i];
          gl.uniform3f(R.prog_BlinnPhong_PointLight.u_lightCol, light.col[0],light.col[1],light.col[2]);
          gl.uniform3f(R.prog_BlinnPhong_PointLight.u_lightPos, light.pos[0],light.pos[1],light.col[2]);
          gl.uniform1f(R.prog_BlinnPhong_PointLight.u_lightRad, R.LIGHT_RADIUS);
          gl.uniform3f(R.prog_BlinnPhong_PointLight.u_campos, state.position[0],state.position[1],state.position[2]);
          var sc = getScissorForLight(state.viewMat, state.projMat, light)
          if(sc) {
            gl.scissor(sc[0],sc[1],sc[2],sc[3]);
            if(cfg.debugScissor) {
              debugger;
              renderFullScreenQuad(R.progRed);
            }
            else {
              renderFullScreenQuad(R.prog_BlinnPhong_PointLight);
            }
          }
        }
        gl.disable(gl.SCISSOR_TEST);
        // TO+DO: In the lighting loop, use the scissor test optimization
        // Enable gl.SCISSOR_TEST, render all lights, then disable it.
        //
        // getScissorForLight returns null if the scissor is off the screen.
        // Otherwise, it returns an array [xmin, ymin, width, height].
        //
        //   var sc = getScissorForLight(state.viewMat, state.projMat, light);

        // Disable blending so that it doesn't affect other code
        gl.disable(gl.BLEND);
    };

    R.pass_tiled.render = function(state) {
        // * Bind R.pass_deferred.fbo to write into for later postprocessing
        gl.bindFramebuffer(gl.FRAMEBUFFER, R.pass_deferred.fbo);

        gl.clearColor(0.0, 0.0, 0.0, 0.0);
        gl.clearDepth(1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);

        // ambient
        bindTexturesForLightPass(R.prog_Ambient);
        gl.uniform3f(R.prog_Ambient.u_ambo, cfg.ambient[0],cfg.ambient[1],cfg.ambient[2]);
        renderFullScreenQuad(R.prog_Ambient);

        bindTexturesForLightPass(R.prog_BlinnPhong_PointLight);

        var tilesize = 100;
        var tileX = Math.floor((width + tilesize - 1),tilesize)
        var tileY = Math.floor((height + tilesize - 1),tilesize)

        var liTex = []; //base for texture holding global light list, 1 x lightList.length
        var ixTex = []; //base for texture holding tile light ix list, 1 x
        var gridTex = [][]; //texture holding light grid, tileX x tileY


        gl.disable(gl.BLEND);
    };

    var bindTexturesForLightPass = function(prog) {
        gl.useProgram(prog.prog);

        // * Bind all of the g-buffers and depth buffer as texture uniform
        //   inputs to the shader
        for (var i = 0; i < R.NUM_GBUFFERS; i++) {
            gl.activeTexture(gl['TEXTURE' + i]);
            gl.bindTexture(gl.TEXTURE_2D, R.pass_copy.gbufs[i]);
            gl.uniform1i(prog.u_gbufs[i], i);
        }
        gl.activeTexture(gl['TEXTURE' + R.NUM_GBUFFERS]);
        gl.bindTexture(gl.TEXTURE_2D, R.pass_copy.depthTex);
        gl.uniform1i(prog.u_depth, R.NUM_GBUFFERS);
    };

    /**
     * 'post1' pass: Perform (first) pass of post-processing
     */
    R.pass_post1.render = function(state) {
        // * Unbind any existing framebuffer (if there are no more passes)
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        // * Clear the framebuffer depth to 1.0
        gl.clearDepth(1.0);
        gl.clear(gl.DEPTH_BUFFER_BIT);

        // * Bind the postprocessing shader program
        gl.useProgram(R.progPost1.prog);

        // * Bind the deferred pass's color output as a texture input
        // Set gl.TEXTURE0 as the gl.activeTexture unit
        // TO+DO: ^
        gl.activeTexture(gl.TEXTURE0);
        // Bind the TEXTURE_2D, R.pass_deferred.colorTex to the active texture unit
        // TO+DO: ^
        gl.bindTexture(gl.TEXTURE_2D, R.pass_deferred.colorTex);
        // Configure the R.progPost1.u_color uniform to point at texture unit 0
        gl.uniform1i(R.progPost1.u_color, 0);

        // * Render a fullscreen quad to perform shading on
        renderFullScreenQuad(R.progPost1);
    };

    var renderProxySphere = (function() {
        var positions = new Float32Array([
            -1.0, -1.0, 0.0,
             1.0, -1.0, 0.0,
            -1.0,  1.0, 0.0,
             1.0,  1.0, 0.0
        ]);
        var vbo = null;
        var init = function() {
            vbo = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER,vbo);
            gl.bufferData(gl.ARRAY_BUFFER,positions,gl.STATIC_DRAW);
        };
        return function(prog) {
            if (!vbo) {
                init();
            }
            gl.useProgram(prog.prog);
            gl.bindBuffer(gl.ARRAY_BUFFER,vbo);
            gl.enableVertexAttribArray(vbo);
            gl.vertexAttribPointer(vbo,3,gl.FLOAT,gl.FALSE,0,0);
            gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
            gl.bindBuffer(gl.ARRAY_BUFFER, null);
        };
    })

    var renderFullScreenQuad = (function() {
        // The variables in this function are private to the implementation of
        // renderFullScreenQuad. They work like static local variables in C++.

        // Create an array of floats, where each set of 3 is a vertex position.
        // You can render in normalized device coordinates (NDC) so that the
        // vertex shader doesn't have to do any transformation; draw two
        // triangles which cover the screen over x = -1..1 and y = -1..1.
        // This array is set up to use gl.drawArrays with gl.TRIANGLE_STRIP.
        var positions = new Float32Array([
            -1.0, -1.0, 0.0,
             1.0, -1.0, 0.0,
            -1.0,  1.0, 0.0,
             1.0,  1.0, 0.0
        ]);

        var vbo = null;

        var init = function() {
            // Create a new buffer with gl.createBuffer, and save it as vbo.
            // TO+DO: ^
            vbo = gl.createBuffer();

            // Bind the VBO as the gl.ARRAY_BUFFER
            // TO+DO: ^
            gl.bindBuffer(gl.ARRAY_BUFFER,vbo);

            // Upload the positions array to the currently-bound array buffer
            // using gl.bufferData in static draw mode.
            // TO+DO: ^
            gl.bufferData(gl.ARRAY_BUFFER,positions,gl.STATIC_DRAW);
        };

        return function(prog) {
            if (!vbo) {
                // If the vbo hasn't been initialized, initialize it.
                init();
            }

            // Bind the program to use to draw the quad
            gl.useProgram(prog.prog);

            // Bind the VBO as the gl.ARRAY_BUFFER
            // TO+DO: ^
            gl.bindBuffer(gl.ARRAY_BUFFER,vbo);

            // Enable the bound buffer as the vertex attrib array for
            // prog.a_position, using gl.enableVertexAttribArray
            // TO+DO: ^
            gl.enableVertexAttribArray(vbo);

            // Use gl.vertexAttribPointer to tell WebGL the type/layout of the buffer
            // TO+DO: ^
            gl.vertexAttribPointer(vbo,3,gl.FLOAT,gl.FALSE,0,0);

            // Use gl.drawArrays (or gl.drawElements) to draw your quad.
            // TO+DO: ^
            gl.drawArrays(gl.TRIANGLE_STRIP,0,4);

            // Unbind the array buffer.
            gl.bindBuffer(gl.ARRAY_BUFFER, null);
        };
    })();
})();
