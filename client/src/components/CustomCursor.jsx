import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const CustomCursor = () => {
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isHovering, setIsHovering] = useState(false);

    useEffect(() => {
        const updatePosition = (e) => {
            setPosition({ x: e.clientX, y: e.clientY });
        };

        const updateHoverState = (e) => {
            if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A' || e.target.closest('button') || e.target.closest('a')) {
                setIsHovering(true);
            } else {
                setIsHovering(false);
            }
        };

        window.addEventListener('mousemove', updatePosition);
        window.addEventListener('mouseover', updateHoverState);

        return () => {
            window.removeEventListener('mousemove', updatePosition);
            window.removeEventListener('mouseover', updateHoverState);
        };
    }, []);

    return (
        <motion.div
            className="hidden md:block fixed top-0 left-0 w-4 h-4 rounded-full bg-gold-500 pointer-events-none z-[9999] mix-blend-difference"
            animate={{
                x: position.x - (isHovering ? 16 : 8),
                y: position.y - (isHovering ? 16 : 8),
                scale: isHovering ? 2 : 1,
                opacity: 1
            }}
            transition={{
                type: "spring",
                damping: 30,
                stiffness: 200,
                mass: 0.5
            }}
        />
    );
};

export default CustomCursor;
