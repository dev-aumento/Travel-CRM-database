import { motion } from 'framer-motion'

export default function Experience() {
    return (
        <section id="experience" className="py-32 px-4 max-w-5xl mx-auto min-h-[60vh] flex flex-col items-center justify-center text-center">
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.8 }}
                className="text-3xl md:text-5xl lg:text-6xl font-serif text-dark leading-snug md:leading-relaxed"
            >
                <span>From designing at </span>
                <span className="inline-flex items-center justify-center mx-2 px-4 py-2 bg-white rounded-full shadow-sm align-middle whitespace-nowrap">
                    <span className="font-sans font-bold text-lg md:text-2xl text-purple-600">ownpath</span>
                </span>
                <span> to building for </span>
                <span className="inline-flex items-center justify-center mx-2 px-4 py-2 bg-white rounded-full shadow-sm align-middle whitespace-nowrap">
                    <span className="font-sans font-bold text-lg md:text-2xl text-orange-500">Swiggy</span>
                </span>
                <span>, and shaping experiences at </span>
                <span className="inline-flex items-center justify-center mx-2 px-4 py-2 bg-white rounded-full shadow-sm align-middle whitespace-nowrap">
                    <span className="font-sans font-bold text-lg md:text-2xl text-blue-600">SDSLabs</span>
                </span>
                <span>...</span>
            </motion.div>
        </section>
    )
}
