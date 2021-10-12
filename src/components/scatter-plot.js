import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { WEBGL } from 'three/examples/jsm/WebGL'
import * as d3 from 'd3';

import useWindowDimension from '../hooks/useWindowDimension';
import defaultColors from '../data/colors-1500.json'

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
        const isArrayLengthEquals = () => id.length === x.length && id.length === y.length && id.length === group.length
        
        // TODO: check assertion: WEBGL compatibility and array length equals

        // 1. create camera, scene, renderer
        const fov = 75, near = 0.1, far = 100000, aspect = width / height;
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
        const vectors = x.map((x, i) => new THREE.Vector3(x, y[i], 0));
        const uniqueGroup = [...new Set(group)];
        console.log(uniqueGroup)
        const colors = [];
        for(const gp of group) {
            const c = new THREE.Color(defaultColors.colors[uniqueGroup.indexOf(gp) % defaultColors.colors.length])
            colors.push(c.r);
            colors.push(c.g);
            colors.push(c.b);
        }
        geometry.setFromPoints(vectors)
        geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3))
        const circle_sprite= new THREE.TextureLoader().load(
            "https://fastforwardlabs.github.io/visualization_assets/circle-sprite.png"
          );
        const pointsMaterial = new THREE.PointsMaterial({
            size: 4,
            // color: 0x00ff00,
            sizeAttenuation: false,
            vertexColors: true,
            map: circle_sprite,
            transparent: true
        });
        const points = new THREE.Points(geometry, pointsMaterial);
        scene.add(points);

        // 4. animate and apply zoom handler
        function animate() {
            requestAnimationFrame( animate );
            renderer.render( scene, camera );
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