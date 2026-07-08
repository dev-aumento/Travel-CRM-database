import { motion } from 'framer-motion'

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 pt-20 pb-10 px-4 transition-colors duration-500">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center md:items-start gap-12">

        {/* Brand Area */}
        <div className="text-center md:text-left">
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="text-2xl font-serif font-bold tracking-wide text-dark dark:text-white mb-4 transition-colors duration-500"
          >
            Jenish Radadiya
          </motion.div>
          <p className="text-dark/60 dark:text-gray-400 font-sans max-w-sm transition-colors duration-500">
            Designing digital experiences that blend aesthetic elegance with intuitive usability.
          </p>
        </div>

        {/* Links */}
        <div className="flex flex-col sm:flex-row gap-12 text-center sm:text-left">
          <div>
            <h4 className="font-bold text-dark dark:text-white mb-6 transition-colors duration-500">Navigation</h4>
            <div className="flex flex-col space-y-3">
              {['About', 'Work', 'Process', 'Testimonials'].map((link) => (
                <a key={link} href={`#${link.toLowerCase()}`} className="text-dark/70 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors">
                  {link}
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-bold text-dark dark:text-white mb-6 transition-colors duration-500">Connect</h4>
            <div className="flex flex-col space-y-3">
              <a href="https://www.linkedin.com/in/jenishradadiya013" target="_blank" rel="noopener noreferrer" className="text-dark/70 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors">LinkedIn</a>
              <a href="mailto:jenish3099@gmail.com" className="text-dark/70 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors">Email</a>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-20 pt-8 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row justify-between items-center transition-colors duration-500">
        <p className="text-dark/50 dark:text-gray-500 font-sans text-sm">
          © {currentYear} Jenish Radadiya. All rights reserved.
        </p>
        <p className="text-dark/40 dark:text-gray-600 font-sans text-sm mt-2 sm:mt-0 italic flex items-center gap-1">
          Designed with <span className="text-primary">♥</span> in India
        </p>
      </div>
    </footer>
  )
}
