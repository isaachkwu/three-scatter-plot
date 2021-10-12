import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { WEBGL } from 'three/examples/jsm/WebGL'
import * as d3 from 'd3';

import useWindowDimension from '../hooks/useWindowDimension';
import defaultColors40 from '../data/colors-40.json'

const ScatterPlot = ({
    id = [],
    x = [],
    y = [],
    group = [],
    optimizedRendering = false
}) => {
    const { width, height } = useWindowDimension();
    const mountRef = useRef(null);

    useEffect(() => {
        const mount = mountRef.current

        // 0. helper functions
        const toRadians = (angle) => angle * (Math.PI / 180);
        
        // 1. create camera, scene, renderer
        const fov = 75, near = 0.1, far = 10, aspect = width / height;
        const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x666666);
        const renderer = new THREE.WebGLRenderer();
        renderer.setSize(width, height );
        mount.appendChild(renderer.domElement)

        // 2. create zoom/pan handler
        const getScaleFromZ = (camera_z_position) => {
            let half_fov = fov / 2;
            let half_fov_radians = toRadians(half_fov);
            let half_fov_height = Math.tan(half_fov_radians) * camera_z_position;
            let fov_height = half_fov_height * 2;
            let scale = height / fov_height; // Divide visualization height by height derived from field of view
            return scale;
        }
        const getZFromScale = (scale) => {
            let half_fov = fov / 2;
            let half_fov_radians = toRadians(half_fov);
            let scale_height = height / scale;
            let camera_z_position = scale_height / (2 * Math.tan(half_fov_radians));
            return camera_z_position;
        }
        const zoomHandler = (d3_transform) => {
            let scale = d3_transform.k;
            let x = -(d3_transform.x - width / 2) / scale;
            let y = (d3_transform.y - height / 2) / scale;
            let z = getZFromScale(scale);
            camera.position.set(x, y, z);
        }
        const d3_zoom = d3.zoom()
            .scaleExtent([getScaleFromZ(far), getScaleFromZ(near)])
            .on('zoom', (event) => {
                let d3_transform = event.transform;
                zoomHandler(d3_transform);
            });
        const setUpZoom = () => {
            const view = d3.select(renderer.domElement)
                .call(d3_zoom);
            const initialScale = getScaleFromZ(far);
            const initialTransform = d3.zoomIdentity.translate(width / 2, height / 2).scale(initialScale);
            d3_zoom.transform(view, initialTransform);
            camera.position.set(0, 0, far)
        }

        // 3. create geometry, material, and points
        const geometry = new THREE.BufferGeometry();

        const material = new THREE.PointsMaterial({ color: 0xdd6666 });
        const cube = new THREE.Mesh(geometry, material);
        scene.add(cube);

        // 4. animate and apply zoom handler
        function animate() {
            requestAnimationFrame( animate );
            renderer.render( scene, camera );
            cube.rotation.x += 0.01;
            cube.rotation.y += 0.01;
        }
        if ( WEBGL.isWebGLAvailable() ) {
            animate();
            setUpZoom();
        } else {
            mount.appendChild( WEBGL.getWebGLErrorMessage() );
        }

        return () => {
            // clean up
            mount.removeChild(renderer.domElement);
        }

    }, [width, x, y, id, group, optimizedRendering, height])

    return <div style={styles.container} ref={mountRef} />
}

const styles = {
    container: {
        margin: 0,
        padding: 0,
    }
}

export default ScatterPlot;