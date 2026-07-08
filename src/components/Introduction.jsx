import { motion } from 'framer-motion'

const skills = [
    "UI Design", "UX Research", "Wireframing", "Prototyping",
    "SaaS Design", "Mobile App Design", "Website Design", "Interaction Design"
]

export default function About() {
    return (
        <section id="about" className="relative py-32 px-4 max-w-6xl mx-auto min-h-[80vh] flex items-center justify-center transition-colors duration-500">
            <div className="flex flex-col md:flex-row gap-16 md:gap-24 items-center">

                {/* Experience Highlight */}
                <motion.div
                    initial={{ opacity: 0, x: -50 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                    className="hidden md:flex flex-col items-center justify-center p-12 bg-white dark:bg-gray-800 rounded-full aspect-square shadow-xl border-8 border-primary dark:border-gray-700 transition-colors duration-500"
                >
                    <span className="text-6xl font-serif font-bold text-dark dark:text-primary">2.5</span>
                    <span className="text-lg font-sans text-dark/60 dark:text-gray-400 font-medium uppercase tracking-wider mt-2">Years Exp.</span>
                </motion.div>

                {/* Bio Content */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="flex-1"
                >
                    <h2 className="text-4xl md:text-6xl font-serif font-bold tracking-wide mb-8 text-dark dark:text-white transition-colors duration-500">
                        About Me
                    </h2>
                    <div className="space-y-6 text-lg md:text-xl text-dark/80 dark:text-gray-300 font-sans font-light leading-relaxed transition-colors duration-500">
                        <p>
                            I am a professional UI/UX designer with experience creating user-friendly digital experiences across multiple industries. Based in India, I specialize in web applications, SaaS platforms, and mobile design.
                        </p>
                        <p>
                            My approach focuses on clean visual design, intuitive navigation, conversion-focused layouts, and user-centered design thinking.
                        </p>
                    </div>

                    {/* Skills Grid */}
                    <div className="mt-12">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-dark/50 dark:text-gray-500 mb-6">Core Competencies</h3>
                        <div className="flex flex-wrap gap-3">
                            {skills.map((skill, index) => (
                                <motion.span
                                    key={index}
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    whileInView={{ opacity: 1, scale: 1 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: 0.4 + (index * 0.05) }}
                                    whileHover={{ y: -2 }}
                                    className="px-4 py-2 bg-white dark:bg-gray-800 border border-dark/10 dark:border-gray-700 text-dark dark:text-gray-200 rounded-full text-sm font-medium shadow-sm transition-all duration-300"
                                >
                                    {skill}
                                </motion.span>
                            ))}
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    )
}
