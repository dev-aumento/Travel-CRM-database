import { motion } from 'framer-motion'

const testimonials = [
    {
        quote: "Jenish is an exceptional designer. He took our complex SaaS requirements and turned them into an intuitive, beautiful interface that our users love.",
        name: "Sarah Jenkins",
        role: "Product Manager at TechFlow"
    },
    {
        quote: "Working with Jenish was a breeze. His attention to detail and understanding of modern web aesthetics significantly elevated our brand's digital presence.",
        name: "Michael Chen",
        role: "Founder, Bloom Creative"
    },
    {
        quote: "He doesn't just make things look good; he thinks deeply about the user journey. The conversion rates on our new landing pages speak for themselves.",
        name: "Emma Davis",
        role: "Head of Marketing, NovaTech"
    }
]

export default function Testimonials() {
    return (
        <section id="testimonials" className="py-32 px-4 max-w-7xl mx-auto transition-colors duration-500">
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
                className="text-center mb-20"
            >
                <h2 className="text-4xl md:text-6xl font-serif font-bold text-dark dark:text-white transition-colors duration-500 mb-4">
                    Client Feedback
                </h2>
                <p className="text-xl text-dark/70 dark:text-gray-400 font-sans max-w-2xl mx-auto transition-colors duration-500">
                    What people I've collaborated with say about my work.
                </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {testimonials.map((testimonial, index) => (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 50 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-50px" }}
                        transition={{ duration: 0.6, delay: index * 0.1 }}
                        className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 transition-all duration-500 hover:shadow-xl hover:-translate-y-2"
                    >
                        {/* Quote Icon */}
                        <div className="text-primary/40 dark:text-primary mb-6">
                            <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h4v10h-10z" />
                            </svg>
                        </div>

                        <p className="text-lg text-dark/80 dark:text-gray-300 font-sans italic leading-relaxed mb-8 transition-colors duration-500">
                            "{testimonial.quote}"
                        </p>

                        <div className="flex items-center">
                            <div className="w-12 h-12 bg-primary/20 dark:bg-primary/10 rounded-full flex items-center justify-center text-xl font-bold text-primary mr-4">
                                {testimonial.name[0]}
                            </div>
                            <div>
                                <h4 className="font-bold text-dark dark:text-white transition-colors duration-500">
                                    {testimonial.name}
                                </h4>
                                <p className="text-sm text-dark/60 dark:text-gray-400 font-sans transition-colors duration-500">
                                    {testimonial.role}
                                </p>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </section>
    )
}
