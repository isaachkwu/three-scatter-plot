import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { WEBGL } from 'three/examples/jsm/WebGL'
import * as d3 from 'd3';

import Slider from '../slider/Slider';

import useWindowDimension from '../../hooks/useWindowDimension';
import defaultColors from '../../data/colors-1400.json'

import './ScatterPlot.css';

const ScatterPlot = ({
    node = [],
    branch = [],
    optimizedRendering = false
}) => {
    const { width, height } = useWindowDimension();
    const [selectedNode, setSelectedNode] = useState(null);
    const [mousePosition, setMousePosition] = useState(null);
    const [selectedNodeColor, setSelectedNodeColor] = useState(null);

    const defaultControlValue = 50

    const [xScaleControl, setXScaleControl] = useState(defaultControlValue);
    const [yScaleControl, setYScaleControl] = useState(defaultControlValue);

    const onChangeXSlider = useCallback((value) => {
        setXScaleControl(value);
    }, [])

    const onChangeYSlider = useCallback((value) => {
        setYScaleControl(value);
    }, [])

    const mountRef = useRef(null);
    const pointsRef = useRef(null);
    const branchesRef = useRef(null);
    const cameraRef = useRef(null);
    const d3ZoomRef = useRef(null);
    const rendererRef = useRef(null);

    // 0. helper functions
    const toRadians = (angle) => angle * (Math.PI / 180);
    const fov = 75, near = 0.1, far = 600, aspect = width / height;

    const getScaleFromZ = useCallback((camera_z_position) => {
        let half_fov = fov / 2;
        let half_fov_radians = toRadians(half_fov);
        let half_fov_height = Math.tan(half_fov_radians) * camera_z_position;
        let fov_height = half_fov_height * 2;
        let scale = height / fov_height; // Divide visualization height by height derived from field of view
        return scale;
    }, [height])

    const resetCamera = () => {
        const view = d3.select(rendererRef.current.domElement)
        const initialTransform = d3.zoomIdentity.translate(width / 2, height / 2).scale(getScaleFromZ(far));
        d3ZoomRef.current.transform(view, initialTransform);
    }

    useEffect(() => {
        const mount = mountRef.current

        // 1. create camera, scene, renderer
        cameraRef.current = new THREE.PerspectiveCamera(fov, aspect, near, far + 1);
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xcccccc);
        rendererRef.current = new THREE.WebGLRenderer();
        rendererRef.current.setSize(width, height);
        mount.appendChild(rendererRef.current.domElement)

        // additional: add double nodes and branches
        const doublesData = (node, branch) => {
            const addedX = d3.max(node, node => node.x) + 100;
            const nodes = [
                ...node,
                ...node.map(node => ({
                    ...node,
                    x: node.x + addedX
                }))
            ]

            const branches = {
                vertical: [
                    ...branch.vertical,
                    ...branch.vertical.map(branch => ([
                        branch[0] + addedX,
                        branch[1],
                        branch[2]
                    ]))
                ],
                horizontal: [
                    ...branch.horizontal,
                    ...branch.horizontal.map(branch => ([
                        branch[0],
                        branch[1] + addedX,
                        branch[2] + addedX
                    ]))
                ]
            }
            return {nodes, branches}
        }
        let {nodes, branches} = doublesData(node, branch)
        const result = doublesData(nodes, branches)
        nodes = result.nodes
        branches = result.branches
        // 2. create zoom/pan handler

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
            cameraRef.current.position.set(_x, _y, _z);
            // console.log(cameraRef.current.position)
        }
        d3ZoomRef.current = d3.zoom()
            .scaleExtent([getScaleFromZ(far), getScaleFromZ(near)])
            .on('zoom', (event) => {
                let d3_transform = event.transform;
                zoomHandler(d3_transform);
            });
        const setUpZoom = () => {
            const view = d3.select(rendererRef.current.domElement)
                .call(d3ZoomRef.current);
            const initialScale = getScaleFromZ(far);
            const initialTransform = d3.zoomIdentity.translate(width / 2, height / 2).scale(initialScale);
            d3ZoomRef.current.transform(view, initialTransform);
            // cameraRef.current.position.set(0, 0, far)
        }

        // 3. create nodes
        const pointGeo = new THREE.BufferGeometry();
        const xExtent = d3.extent(nodes, node => node.x);
        const yExtent = d3.extent(nodes, node => node.y);
        const xScale = d3.scaleLinear()
            .domain(xExtent)
            .range([-400, 400]);
        const yScale = d3.scaleLinear()
            .domain(yExtent)
            .range([-300, 300]);
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
        pointGeo.setFromPoints(vectors)
        pointGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3))
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
        pointsRef.current = new THREE.Points(pointGeo, pointsMaterial);
        pointsRef.current.geometry.attributes.position.needsUpdate = true;
        scene.add(pointsRef.current);

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
        const branchesGeo = new THREE.BufferGeometry().setFromPoints(linePoints);
        branchesRef.current = new THREE.LineSegments(branchesGeo, lineMaterial);
        branchesRef.current.geometry.attributes.position.needsUpdate = true;
        scene.add(branchesRef.current)
        // branchesRef.current.scale.set(1.5, 1.5, 1);
        // pointsRef.current.scale.set(1.5, 1.5, 1);

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
            d3.select(rendererRef.current.domElement)
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
            raycaster.setFromCamera(mouseVector, cameraRef.current);
            const intersects = raycaster.intersectObject(pointsRef.current);
            if (intersects[0]) {
                const sortedntersection = intersects.sort((a, b) => {
                    if (a.distanceToRay < b.distanceToRay) {
                        return -1
                    }
                    if (a.distanceToRay > b.distanceToRay) {
                        return 1
                    }
                    return 0
                })
                // console.log(sortedntersection.map(e => e.distanceToRay))
                const firstIntersect = sortedntersection[0]
                const selectedNode = nodes[firstIntersect.index];
                const scale = firstIntersect.object.scale
                // console.log(scale)
                highlightPoint(selectedNode, scale);
                showTooltip(mousePosition, selectedNode);
            } else {
                removeHighlight();
                hideTooltip();
            }
        }
        const hoverContainer = new THREE.Object3D();
        scene.add(hoverContainer);
        const highlightPoint = (node, scale) => {
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
            point.scale.set(scale.x, scale.y, scale.z)
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
            rendererRef.current.render(scene, cameraRef.current);
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
            mount.removeChild(rendererRef.current.domElement);
        }

    }, [node, branch, optimizedRendering, height, width, aspect, getScaleFromZ])

    useEffect(() => {
        if (pointsRef.current !== null && branchesRef.current !== null) {
            const xRatio = xScaleControl / 50;
            const yRatio = yScaleControl / 50;
            const previousXScale = pointsRef.current.scale.x
            const previousYScale = branchesRef.current.scale.y
            pointsRef.current.scale.set(xRatio, yRatio, 1);
            branchesRef.current.scale.set(xRatio, yRatio, 1);

            const currentThreeX = cameraRef.current.position.x;
            const currentThreeY = cameraRef.current.position.y;
            const currentThreeZ = cameraRef.current.position.z;

            const targetThreeX = currentThreeX / previousXScale * xRatio
            const targetThreeY = currentThreeY / previousYScale * yRatio
            const currentScale = getScaleFromZ(currentThreeZ);

            const d3X = -(targetThreeX * currentScale) + width / 2
            const d3Y = targetThreeY * currentScale + height / 2

            const view = d3.select(rendererRef.current.domElement)
            const initialTransform = d3.zoomIdentity.translate(d3X, d3Y).scale(currentScale);
            d3ZoomRef.current.transform(view, initialTransform);
        }
    }, [getScaleFromZ, height, width, xScaleControl, yScaleControl])

    const tooltipWidth = 120
    const tooltipXOffset = -tooltipWidth / 2;
    const tooltipYOffset = 30
    return <>
        <div style={styles.xSliderContainer}>
            <Slider
                orientation="horizontal"
                min={1}
                max={800}
                title='Horizontal slider'
                defaultValue={defaultControlValue}
                onChange={onChangeXSlider}
            />
        </div>
        <div style={styles.ySliderContainer}>
            <Slider
                orientation="vertical"
                min={1}
                max={100}
                title='Vertical slider'
                defaultValue={defaultControlValue}
                onChange={onChangeYSlider}
            />
        </div>
        <div className='buttonContainer'>
            <button className='resetButton' onClick={resetCamera}>reset camera</button>
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
}

export default ScatterPlot;