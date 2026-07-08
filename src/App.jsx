import Navbar from './components/Navbar'
import Hero from './components/Hero'
import About from './components/Introduction'
import Portfolio from './components/Portfolio'
import Process from './components/Process'
import Testimonials from './components/Testimonials'
import Contact from './components/Contact'
import Footer from './components/Footer'

export default function App() {
  return (
    <div className="min-h-screen bg-primary dark:bg-gray-900 transition-colors duration-500">
      <Navbar />
      <Hero />
      <About />
      <Portfolio />
      <Process />
      <Testimonials />
      <Contact />
      <Footer />
    </div>
  )
}
