import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { WEBGL } from 'three/examples/jsm/WebGL'
import * as d3 from 'd3';

import DebounceSlider from './DebounceSlider';

import useWindowDimension from '../hooks/useWindowDimension';
import defaultColors from '../data/colors-1400.json'

const ScatterPlot = ({
    nodes = [],
    branches = [],
    optimizedRendering = false
}) => {
    const { width, height } = useWindowDimension();
    const [selectedNode, setSelectedNode] = useState(null);
    const [mousePosition, setMousePosition] = useState(null);
    const [selectedNodeColor, setSelectedNodeColor] = useState(null);

    const [xScaleControl, setXScaleControl] = useState(50);
    const [yScaleControl, setYScaleControl] = useState(50);

    const onChangeXSlider = (e) => {
        setXScaleControl(e.target.value);
    }

    const onChangeYSlider = (e) => {
        setYScaleControl(e.target.value);
    }

    const mountRef = useRef(null);

    useEffect(() => {
        const mount = mountRef.current

        // 0. helper functions
        const toRadians = (angle) => angle * (Math.PI / 180);

        // 1. create camera, scene, renderer
        const fov = 75, near = 0.1, far = 600, aspect = width / height;
        const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xcccccc);
        const renderer = new THREE.WebGLRenderer();
        renderer.setSize(width, height);
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
            let _x = -(d3_transform.x - width / 2) / scale;
            let _y = (d3_transform.y - height / 2) / scale;
            let _z = getZFromScale(scale);
            camera.position.set(_x, _y, _z);
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

        // 3. create nodes
        const geometry = new THREE.BufferGeometry();
        const xExtent = d3.extent(nodes, node => node.x);
        const yExtent = d3.extent(nodes, node => node.y);
        const xScale = d3.scaleLinear()
            .domain(xExtent)
            .range([-xScaleControl * 8, xScaleControl * 8]);
        const yScale = d3.scaleLinear()
            .domain(yExtent)
            .range([-yScaleControl * 6, yScaleControl * 6]);
        const vectors = nodes.map((node) => new THREE.Vector3(xScale(node.x), yScale(node.y), 0));
        const uniqueGroup = [...new Set(nodes.map(node => node.group))];
        // console.log(uniqueGroup)
        const colors = [];
        for (const node of nodes) {
            if (node.group === '') {
                colors.push(0, 0, 0) //black node is for nodes with no group assigned
            } else {
                const c = new THREE.Color(defaultColors.colors[uniqueGroup.indexOf(node.group) % defaultColors.colors.length])
                colors.push(c.r, c.g, c.b);
            }
        }
        geometry.setFromPoints(vectors)
        geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3))
        const circle_sprite = new THREE.TextureLoader().load(
            "https://fastforwardlabs.github.io/visualization_assets/circle-sprite.png"
        );
        const pointsMaterial = new THREE.PointsMaterial({
            size: 4,
            sizeAttenuation: false,
            vertexColors: true,
            map: circle_sprite,
            transparent: true,
        });
        const points = new THREE.Points(geometry, pointsMaterial);
        scene.add(points);

        // 4. Create branches
        const lineMaterial = new THREE.LineBasicMaterial({
            color: 0x000000
        });
        const linePoints = []
        if (branches.horizontal !== undefined) {
            branches.horizontal.forEach(pair => {
                const y = yScale(pair[0])
                const x0 = xScale(pair[1])
                const x1 = xScale(pair[2])
                linePoints.push(
                    new THREE.Vector3(x0, y, 0),
                    new THREE.Vector3(x1, y, 0))
            })
        }
        if (branches.vertical !== undefined) {
            branches.vertical.forEach(pair => {
                const x = xScale(pair[0])
                const y0 = yScale(pair[1])
                const y1 = yScale(pair[2])
                linePoints.push(
                    new THREE.Vector3(x, y0, 0),
                    new THREE.Vector3(x, y1, 0)
                )
            });
        }
        const lineGeometry = new THREE.BufferGeometry().setFromPoints(linePoints);
        const lineSeg = new THREE.LineSegments(lineGeometry, lineMaterial);
        scene.add(lineSeg)

        // 5. craete hover interaction
        const raycaster = new THREE.Raycaster();
        raycaster.params.Points.threshold = 6;
        const mouseToThree = (mouseX, mouseY) => (
            new THREE.Vector3(
                mouseX / width * 2 - 1,
                -(mouseY / height) * 2 + 1,
                1
            )
        )
        const setUpHover = () => {
            const view = d3.select(renderer.domElement)
                .on("mousemove", (event) => {
                    const [mouseX, mouseY] = d3.pointer(event);
                    const mousePosition = [mouseX, mouseY]
                    // console.log(mouseToThree)
                    checkIntersects(mousePosition);
                })
                .on("mouseleave", () => {
                    removeHighlight()
                    hideTooltip();
                })
        }
        const checkIntersects = (mousePosition) => {
            const mouseVector = mouseToThree(...mousePosition);
            raycaster.setFromCamera(mouseVector, camera);
            const intersects = raycaster.intersectObject(points);
            if (intersects[0]) {
                const firstIntersect = intersects.sort((a, b) => {
                    if (a.distanceToRay < b.distanceToRay) {
                        return -1
                    }
                    if (a.distanceToRay > b.distanceToRay) {
                        return 1
                    }
                    return 0
                })[0]
                const selectedNode = nodes[firstIntersect.index];
                // console.log(selectedNode)
                highlightPoint(selectedNode);
                showTooltip(mousePosition, selectedNode);
            } else {
                removeHighlight();
                hideTooltip();
            }
        }
        const hoverContainer = new THREE.Object3D();
        scene.add(hoverContainer);
        const highlightPoint = (node) => {
            removeHighlight();
            const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(xScale(node.x), yScale(node.y), 0)]);
            const c = node.group === '' ? '#000000' : new THREE.Color(defaultColors.colors[uniqueGroup.indexOf(node.group) % defaultColors.colors.length])
            geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array([
                c.r, c.g, c.b
            ]), 3))
            const pointMaterial = new THREE.PointsMaterial({
                size: 12,
                sizeAttenuation: false,
                vertexColors: true,
                map: circle_sprite,
                transparent: true,
            });
            const point = new THREE.Points(geometry, pointMaterial);
            hoverContainer.add(point);
        }

        const removeHighlight = () => {
            hoverContainer.remove(...hoverContainer.children)
        }

        const showTooltip = (mousePosition, node) => {
            setSelectedNode(node);
            const c = node.group === '' ? '#000000' : defaultColors.colors[uniqueGroup.indexOf(node.group) % defaultColors.colors.length]
            setSelectedNodeColor(c);
            setMousePosition(mousePosition)
        }

        const hideTooltip = () => {
            setSelectedNode(null);
            setSelectedNodeColor(null);
            setMousePosition(null)
        }

        // 6. animate and apply zoom handler
        function animate() {
            requestAnimationFrame(animate);
            renderer.render(scene, camera);
        }
        if (WEBGL.isWebGLAvailable()) {
            animate();
            setUpZoom();
            setUpHover();

        } else {
            mount.appendChild(WEBGL.getWebGLErrorMessage());
        }

        return () => {
            // clean up
            mount.removeChild(renderer.domElement);
        }

    }, [nodes, branches, optimizedRendering, height, width, xScaleControl, yScaleControl])

    const tooltipWidth = 120
    const tooltipXOffset = -tooltipWidth / 2;
    const tooltipYOffset = 30
    return <>
        <div style={styles.xSliderContainer}>
            <DebounceSlider
                orientation="horizontal"
                min={1}
                max={100}
                title='Horizontal slider'
                onChange={onChangeXSlider}
            />
        </div>
        <div style={styles.ySliderContainer}>
            <DebounceSlider
                orientation="vertical"
                min={1}
                max={100}
                title='Vertical slider'
                onChange={onChangeYSlider}
            />
        </div>
        <div style={{
            display: selectedNode ? "flex" : "none",
            position: "absolute",
            left: mousePosition ? mousePosition[0] + tooltipXOffset : 0,
            top: mousePosition ? mousePosition[1] + tooltipYOffset : 0,
            ...styles.tooltip
        }}>
            ID: {selectedNode && selectedNode.id}
            <br />
            <div style={{
                color: selectedNode && selectedNode.group === '' ? 'white' : 'black',
                backgroundColor: selectedNodeColor ? selectedNodeColor : 'white',
                ...styles.groupBox
            }}>
                Group: {selectedNode && selectedNode.group}
            </div>
        </div>
        <div style={styles.container} ref={mountRef} />
    </>
}

const styles = {
    container: {
        margin: 0,
        padding: 0,
    },
    tooltip: {
        backgroundColor: 'white',
        padding: 8,
        flexDirection: 'column',
        alignItems: 'stretch'
    },
    groupBox: {
        padding: 4,
    },
    xSliderContainer: {
        position: 'absolute',
        bottom: 8,
        left: 0,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
    },
    ySliderContainer: {
        position: 'absolute',
        left: 8,
        top: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center'
    },
    xSliderTitle: {
        // backgroundColor: '#00ff00',
        textAlign: 'left'
    },
    ySliderTitle: {
        transform: 'rotate(90deg)',
        height: '20px',
        transformOrigin: '10px 10px',
        // backgroundColor: '#00ff00',
        display: 'inline-block',
        textAlign: 'left'
    },
    xSlider: {
        width: 300,
        height: 20
    }, 
    ySlider: {
        height: 300,
        width: 20,
        '-webkit-appearance': 'slider-vertical',
        writingMode: 'bt-lr',
        orient: "vertical"
    },
    xInnerSliderContainer: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'align-start'
    },
    yInnerSliderContainer: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'align-start'
    }
}

export default ScatterPlot;