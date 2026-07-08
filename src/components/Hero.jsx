import { motion } from 'framer-motion'

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20 transition-colors duration-500">

      {/* Floating abstract elements */}
      <motion.div
        animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }}
        transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
        className="absolute top-1/4 left-1/4 w-32 h-32 bg-white/20 dark:bg-white/5 backdrop-blur-3xl rounded-full blur-xl"
      />
      <motion.div
        animate={{ y: [0, 30, 0], rotate: [0, -10, 0] }}
        transition={{ repeat: Infinity, duration: 8, ease: "easeInOut" }}
        className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-white/30 dark:bg-white/5 backdrop-blur-3xl rounded-full blur-2xl"
      />

      <div className="relative z-10 text-center px-4 max-w-5xl mx-auto flex flex-col items-center">
        {/* Avatar/Personal Branding Placeholder */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
          className="w-32 h-32 rounded-full mb-8 border-4 border-white/50 dark:border-gray-700 shadow-xl overflow-hidden bg-white dark:bg-gray-800 flex items-center justify-center"
        >
          <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80" alt="Jenish Radadiya" className="w-full h-full object-cover" />
        </motion.div>

        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <motion.h1
            className="text-5xl md:text-7xl lg:text-8xl font-serif text-dark dark:text-white mb-6 leading-tight transition-colors duration-500"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.3 }}
          >
            UI/UX Designer crafting intuitive digital experiences
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.8 }}
            className="text-xl md:text-2xl text-dark/80 dark:text-gray-300 max-w-3xl mx-auto font-sans font-light leading-relaxed transition-colors duration-500"
          >
            I specialize in clean visual design, conversion-focused layouts, and user-centered solutions for web and mobile.
          </motion.p>
        </motion.div>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.8 }}
          className="flex flex-col sm:flex-row gap-4 mt-12"
        >
          <a href="#work" className="px-8 py-4 bg-dark dark:bg-primary text-primary dark:text-dark rounded-full font-bold text-lg hover:scale-105 active:scale-95 transition-all shadow-lg">
            View Work
          </a>
          <a href="#contact" className="px-8 py-4 bg-white dark:bg-gray-800 text-dark dark:text-white border border-transparent dark:border-gray-700 rounded-full font-bold text-lg hover:scale-105 active:scale-95 transition-all shadow-md">
            Contact Me
          </a>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-12 left-1/2 transform -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="flex flex-col items-center gap-2"
        >
          <span className="text-xs font-medium tracking-widest text-dark/60 dark:text-gray-400 uppercase transition-colors duration-500">Scroll</span>
          <svg className="w-5 h-5 text-dark/60 dark:text-gray-400 transition-colors duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </motion.div>
      </motion.div>
    </section>
  )
}
