import { motion } from 'framer-motion'

const experiences = [
    {
        id: 1,
        role: 'Product Design Intern',
        company: 'Swiggy',
        period: '2023 - Present',
        description: 'Working on consumer-facing delivery experiences.',
        logo: 'S'
    },
    {
        id: 2,
        role: 'Product Designer',
        company: 'ownpath',
        period: '2022 - 2023',
        description: 'Designed interfaces for a design learning platform.',
        logo: 'O'
    },
    {
        id: 3,
        role: 'Design Lead',
        company: 'SDSLabs',
        period: '2021 - 2022',
        description: 'Led a team of designers to build campus products.',
        logo: 'SD'
    },
    {
        id: 4,
        role: 'Student',
        company: 'IIT Roorkee',
        period: '2020 - 2024',
        description: 'B.Tech in Engineering Physics.',
        logo: 'IIT'
    }
]

export default function Timeline() {
    return (
        <section id="timeline" className="py-24 px-4 max-w-4xl mx-auto min-h-screen">
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
                className="text-center mb-16"
            >
                <h2 className="text-4xl md:text-5xl font-serif font-bold text-dark mb-4">Journey so far</h2>
            </motion.div>

            <div className="relative border-l-2 border-white/50 py-4 ml-8 md:ml-12 pl-8 md:pl-12 space-y-16">
                {experiences.map((exp, index) => (
                    <motion.div
                        key={exp.id}
                        initial={{ opacity: 0, x: -50 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true, margin: "-50px" }}
                        transition={{ duration: 0.6, delay: 0.1 * index }}
                        className="relative"
                    >
                        {/* Glowing dot on the timeline */}
                        <div className="absolute -left-[41px] md:-left-[57px] top-2 w-4 h-4 bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.8)] border border-primary"></div>

                        <div className="flex flex-col md:flex-row gap-6 items-start">
                            {/* Logo block */}
                            <div className="w-16 h-16 shrink-0 bg-white rounded-2xl shadow-sm flex items-center justify-center text-xl font-bold text-primary font-sans border-2 border-white/60">
                                {exp.logo}
                            </div>

                            {/* Content */}
                            <div>
                                <h3 className="text-2xl font-serif font-bold text-dark">{exp.role}</h3>
                                <div className="flex items-center gap-3 text-dark/70 font-sans mt-1 mb-3">
                                    <span className="font-semibold">{exp.company}</span>
                                    <span className="w-1 h-1 bg-dark/40 rounded-full"></span>
                                    <span className="text-sm">{exp.period}</span>
                                </div>
                                <p className="text-dark/80 font-sans font-light">
                                    {exp.description}
                                </p>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </section>
    )
}
