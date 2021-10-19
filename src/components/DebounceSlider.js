import React, { useState, useEffect, useRef } from 'react'

const DebounceSlider = ({
    orientation, //vertical or horizontal
    title,
    min,
    max,
    defaultValue,
    onChange
}) => {

    const [range, setRange] = useState(defaultValue)
    const timeout = useRef(null)

    const handleChangeDebounce = (e) => {
        setRange(e.target.value);
        // clearTimeout(timeout.current);
        // timeout.current = setTimeout(() => {
            onChange(e)
        // }, 100);
    };

    useEffect(() => () => {
        if (timeout.current) clearTimeout(timeout.current);
    }, [])

    const renderHorizontalSlider = () => (
        <div style={styles.xInnerSliderContainer}>
                <span style={styles.xSliderTitle}>{title}</span>
                <input 
                    style={styles.xSlider} 
                    type="range" 
                    min={min}
                    max={max}
                    value={range}
                    onChange={handleChangeDebounce}
                />
            </div>
    )

    const renderVerticalSlider = () => (
        <div style={styles.yInnerSliderContainer}>
                <input 
                    style={styles.ySlider} 
                    type="range" 
                    min={min}
                    max={max}
                    value={range}
                    onChange={handleChangeDebounce}
                />
                <span style={styles.ySliderTitle}>{title}</span>
            </div>
    )

    return (
        <>
            {orientation === 'vertical' ? renderVerticalSlider() : renderHorizontalSlider()}
        </>
    )
}

const styles = {
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
        WebkitAppearance: 'slider-vertical',
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

export default DebounceSlider