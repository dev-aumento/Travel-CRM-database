import { motion } from 'framer-motion'

export default function Contact() {
    return (
        <section id="contact" className="py-32 px-4 max-w-7xl mx-auto transition-colors duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">

                {/* Contact Info */}
                <motion.div
                    initial={{ opacity: 0, x: -30 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                >
                    <h2 className="text-4xl md:text-6xl font-serif font-bold text-dark dark:text-white transition-colors duration-500 mb-6">
                        Let's build something beautiful.
                    </h2>
                    <p className="text-xl text-dark/70 dark:text-gray-400 font-sans mb-12 transition-colors duration-500 leading-relaxed">
                        Whether you have a project in mind, need design consultation, or just want to say hi, my inbox is always open.
                    </p>

                    <div className="space-y-8">
                        <div className="flex items-start">
                            <div className="w-12 h-12 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center text-primary shadow-sm mr-6">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                            </div>
                            <div>
                                <h4 className="text-sm font-bold uppercase tracking-widest text-dark/50 dark:text-gray-500 mb-1">Email</h4>
                                <a href="mailto:jenish3099@gmail.com" className="text-lg md:text-xl font-medium text-dark dark:text-white hover:text-primary dark:hover:text-primary transition-colors">
                                    jenish3099@gmail.com
                                </a>
                            </div>
                        </div>

                        <div className="flex items-start">
                            <div className="w-12 h-12 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center text-primary shadow-sm mr-6">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                            </div>
                            <div>
                                <h4 className="text-sm font-bold uppercase tracking-widest text-dark/50 dark:text-gray-500 mb-1">Phone / WhatsApp</h4>
                                <a href="tel:+918238367018" className="text-lg md:text-xl font-medium text-dark dark:text-white hover:text-primary dark:hover:text-primary transition-colors">
                                    +91 8238367018
                                </a>
                            </div>
                        </div>

                        <div className="flex items-start">
                            <div className="w-12 h-12 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center text-primary shadow-sm mr-6">
                                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" clipRule="evenodd" /></svg>
                            </div>
                            <div>
                                <h4 className="text-sm font-bold uppercase tracking-widest text-dark/50 dark:text-gray-500 mb-1">LinkedIn</h4>
                                <a href="https://www.linkedin.com/in/jenishradadiya013" target="_blank" rel="noopener noreferrer" className="text-lg md:text-xl font-medium text-dark dark:text-white hover:text-primary dark:hover:text-primary transition-colors">
                                    linkedin.com/in/jenishradadiya013
                                </a>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Contact Form */}
                <motion.div
                    initial={{ opacity: 0, x: 30 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="bg-white dark:bg-gray-800 p-8 md:p-12 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 transition-colors duration-500"
                >
                    <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-dark/70 dark:text-gray-300 mb-2">Full Name</label>
                            <input
                                type="text"
                                id="name"
                                className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all duration-300 text-dark dark:text-white"
                                placeholder="John Doe"
                            />
                        </div>

                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-dark/70 dark:text-gray-300 mb-2">Email Address</label>
                            <input
                                type="email"
                                id="email"
                                className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all duration-300 text-dark dark:text-white"
                                placeholder="john@example.com"
                            />
                        </div>

                        <div>
                            <label htmlFor="message" className="block text-sm font-medium text-dark/70 dark:text-gray-300 mb-2">Your Message</label>
                            <textarea
                                id="message"
                                rows="5"
                                className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all duration-300 text-dark dark:text-white resize-none"
                                placeholder="Tell me about your project..."
                            ></textarea>
                        </div>

                        <button
                            type="submit"
                            className="w-full py-4 bg-dark dark:bg-primary text-primary dark:text-dark font-bold text-lg rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md mt-4"
                        >
                            Send Message
                        </button>
                    </form>
                </motion.div>

            </div>
        </section>
    )
}
