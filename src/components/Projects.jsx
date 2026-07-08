import { motion } from 'framer-motion'

const projects = [
    {
        id: 1,
        title: 'Swiggy Scenes',
        description: 'A feature allowing users to order food together.',
        image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80',
        color: 'bg-orange-100'
    },
    {
        id: 2,
        title: 'ownpath App',
        description: 'Designing learning experiences for designers.',
        image: 'https://images.unsplash.com/photo-1542744094-3a31f272c490?w=800&q=80',
        color: 'bg-purple-100'
    },
    {
        id: 3,
        title: 'Echoes Interface',
        description: 'A novel approach to productivity tools.',
        image: 'https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?w=800&q=80',
        color: 'bg-blue-100'
    }
]

export default function Projects() {
    return (
        <section id="projects" className="py-24 px-4 max-w-7xl mx-auto min-h-screen">
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
                className="text-center mb-20"
            >
                <h2 className="text-5xl font-serif font-bold text-dark mb-4">Stuff I've worked on</h2>
                <p className="text-dark/60 font-sans">A selection of my recent works.</p>
            </motion.div>

            <div className="space-y-32">
                {projects.map((project, index) => (
                    <motion.div
                        key={project.id}
                        initial={{ opacity: 0, y: 50 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-100px" }}
                        transition={{ duration: 0.8 }}
                        className={`flex flex-col ${index % 2 !== 0 ? 'lg:flex-row-reverse' : 'lg:flex-row'} items-center gap-12 lg:gap-24`}
                    >
                        {/* The Gadget Frame */}
                        <div className="flex-1 w-full max-w-2xl">
                            <div className={`relative p-8 md:p-12 rounded-[3rem] shadow-2xl ${project.color} border-[12px] border-white/50 backdrop-blur-sm`}>

                                {/* Gadget Details - Fake buttons/camera */}
                                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-24 h-4 rounded-full bg-white/40"></div>
                                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full bg-white border-4 border-white/40 shadow-inner flex items-center justify-center">
                                    <div className="w-6 h-6 rounded-full bg-gray-200"></div>
                                </div>

                                {/* Screen Content */}
                                <div className="relative mt-4 mb-8 bg-white rounded-2xl overflow-hidden shadow-inner aspect-[4/3] border-4 border-gray-100">
                                    <img src={project.image} alt={project.title} className="w-full h-full object-cover" />
                                </div>
                            </div>
                        </div>

                        {/* Project Info */}
                        <div className="flex-1 text-center lg:text-left">
                            <h3 className="text-4xl font-serif font-bold text-dark mb-4">{project.title}</h3>
                            <p className="text-xl text-dark/70 font-sans font-light mb-8 max-w-md mx-auto lg:mx-0">
                                {project.description}
                            </p>
                            <a href="#" className="inline-flex items-center gap-2 px-6 py-3 bg-white text-dark rounded-full font-medium shadow-sm hover:shadow-md transition">
                                View Case Study
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                            </a>
                        </div>
                    </motion.div>
                ))}
            </div>
        </section>
    )
}
