import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'

export default function Navbar() {
  const [isDark, setIsDark] = useState(false)

  // Toggle theme logic
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDark])

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="fixed top-0 w-full bg-transparent z-50 pt-6"
    >
      <div className="max-w-6xl mx-auto px-6 sm:px-8">
        <div className="flex justify-between items-center bg-white/30 dark:bg-gray-800/50 backdrop-blur-md rounded-full px-6 py-3 border border-white/20 dark:border-gray-700/50 shadow-sm transition-colors duration-500">
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="text-xl font-serif font-bold tracking-wide text-dark dark:text-white transition-colors duration-500"
          >
            Jenish Radadiya
          </motion.div>

          <div className="hidden md:flex space-x-8">
            {['About', 'Work', 'Process', 'Testimonials'].map((item) => (
              <motion.a
                key={item}
                href={`#${item.toLowerCase()}`}
                whileHover={{ y: -2 }}
                className="text-sm font-medium text-dark/80 dark:text-gray-300 hover:text-dark dark:hover:text-white transition"
              >
                {item}
              </motion.a>
            ))}
          </div>

          <div className="flex items-center space-x-4">
            {/* Theme Toggle Button */}
            <motion.button
              onClick={() => setIsDark(!isDark)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="p-2 rounded-full bg-white/50 dark:bg-gray-700 text-dark dark:text-yellow-400 shadow-sm transition-colors duration-500"
              aria-label="Toggle Dark Mode"
            >
              {isDark ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
              )}
            </motion.button>

            <motion.a
              href="#contact"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-dark dark:bg-primary text-primary dark:text-dark px-5 py-2 rounded-full text-sm font-bold transition-colors duration-500"
            >
              Contact Me
            </motion.a>
          </div>
        </div>
      </div>
    </motion.nav>
  )
}
