import { motion } from 'framer-motion'

const steps = [
    {
        phase: "01",
        title: "Discover",
        description: "Understanding business goals, user needs, and defining the core problem space."
    },
    {
        phase: "02",
        title: "Research",
        description: "Conducting user interviews, competitive analysis, and gathering actionable insights."
    },
    {
        phase: "03",
        title: "Wireframe",
        description: "Creating low-fidelity blueprints to map out user flows and structural hierarchy."
    },
    {
        phase: "04",
        title: "Design",
        description: "Crafting high-fidelity, polished visual interfaces that align with the brand identity."
    },
    {
        phase: "05",
        title: "Prototype",
        description: "Building interactive models to test usability and validate design decisions."
    },
    {
        phase: "06",
        title: "Handoff",
        description: "Delivering comprehensively documented assets and specs for seamless engineering implementation."
    }
]

export default function Process() {
    return (
        <section id="process" className="py-32 bg-white/50 dark:bg-gray-800/20 backdrop-blur-3xl transition-colors duration-500">
            <div className="max-w-7xl mx-auto px-4">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                    className="text-center mb-20"
                >
                    <h2 className="text-4xl md:text-6xl font-serif font-bold text-dark dark:text-white transition-colors duration-500 mb-4">
                        Design Process
                    </h2>
                    <p className="text-xl text-dark/70 dark:text-gray-400 font-sans max-w-2xl mx-auto transition-colors duration-500">
                        A systematic approach ensuring products are built for users while achieving business objectives.
                    </p>
                </motion.div>

                <div className="relative">
                    {/* Connecting Line (Desktop) */}
                    <div className="hidden md:block absolute top-[4.5rem] left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent dark:via-gray-600 opacity-50 transition-colors duration-500" />

                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-8">
                        {steps.map((step, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 50 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: "-50px" }}
                                transition={{ duration: 0.6, delay: index * 0.1 }}
                                className="relative flex flex-col items-center text-center group"
                            >
                                {/* Number Circle */}
                                <motion.div
                                    whileHover={{ scale: 1.1, rotate: 10 }}
                                    className="w-20 h-20 mb-6 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center text-2xl font-serif font-bold text-dark dark:text-white shadow-lg border-4 border-transparent group-hover:border-primary transition-all duration-300 z-10"
                                >
                                    {step.phase}
                                </motion.div>

                                <h3 className="text-xl font-bold font-sans text-dark dark:text-white mb-3 group-hover:text-primary transition-colors duration-300">
                                    {step.title}
                                </h3>
                                <p className="text-sm text-dark/70 dark:text-gray-400 font-sans leading-relaxed transition-colors duration-500">
                                    {step.description}
                                </p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    )
}
