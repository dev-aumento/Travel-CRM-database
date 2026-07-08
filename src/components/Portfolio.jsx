import { motion } from 'framer-motion'

const projects = [
    {
        title: "Nikon Z Cinema",
        industry: "Photography / E-commerce",
        description: "Digital experience for Nikon's high-end cinematography products.",
        link: "https://www.nikon.com.au/z-cinema",
        image: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&q=80"
    },
    {
        title: "Nikon Z9 Firmware",
        industry: "Tech / Electronics",
        description: "Update portal for Nikon's flagship Z9 mirrorless camera.",
        link: "https://www.nikon-asia.com/z9-firmware-updates",
        image: "https://images.unsplash.com/photo-1502920956877-5060fbf02c2e?w=800&q=80"
    },
    {
        title: "Nikon Mirrorless",
        industry: "Photography / E-commerce",
        description: "Product showcase for the Nikon Z series mirrorless cameras.",
        link: "https://www.nikon.co.in/mirrorless-cameras",
        image: "https://images.unsplash.com/photo-1533134486753-c833f6dcdebb?w=800&q=80"
    },
    {
        title: "Brookfield",
        industry: "Real Estate / Logistics",
        description: "Corporate website for global logistics and real estate management.",
        link: "https://brookfield.net.au/",
        image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&q=80"
    },
    {
        title: "IdentiMark",
        industry: "Manufacturing / Branding",
        description: "B2B platform for custom identification and branding solutions.",
        link: "https://www.identimark.co.uk/",
        image: "https://images.unsplash.com/photo-1558486012-817176f84c6d?w=800&q=80"
    },
    {
        title: "Cable Labels",
        industry: "Industrial / E-commerce",
        description: "Streamlined e-commerce experience for industrial cable labeling.",
        link: "https://cablelabels.uk/",
        image: "https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=800&q=80"
    },
    {
        title: "Shopy Studio",
        industry: "E-commerce Agency",
        description: "Creative agency portfolio specializing in Shopify development.",
        link: "https://shopystudio.com/",
        image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80"
    },
    {
        title: "Keratin Revolution Pro",
        industry: "Beauty / Professional",
        description: "B2B portal for salon professionals.",
        link: "https://keratinrevolutionpro.com/",
        image: "https://images.unsplash.com/photo-1562322140-8baeececf3df?w=800&q=80"
    },
    {
        title: "Two Sisters The Label",
        industry: "Fashion / E-commerce",
        description: "High-end fashion e-commerce store with an elegant aesthetic.",
        link: "https://www.twosistersthelabel.com/",
        image: "https://images.unsplash.com/photo-1445205170230-053b83016050?w=800&q=80"
    },
    {
        title: "Keratin Revolution",
        industry: "Beauty / E-commerce",
        description: "DTC e-commerce site for premium hair care products.",
        link: "https://www.keratinrevolution.co.uk/",
        image: "https://images.unsplash.com/photo-1522337660859-02fbefca4702?w=800&q=80"
    },
    {
        title: "Asta Resort",
        industry: "Fashion / Lifestyle",
        description: "Luxury resort wear brand with a visually stunning shopping experience.",
        link: "https://astaresort.com/",
        image: "https://images.unsplash.com/photo-1540340061722-9293d5163008?w=800&q=80"
    },
    {
        title: "Paste Sports",
        industry: "Sports / Retail",
        description: "Dynamic e-commerce platform for sports equipment.",
        link: "https://www.paste-sports.com/en",
        image: "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&q=80"
    },
    {
        title: "Horando",
        industry: "Luxury Watches",
        description: "Premium marketplace for luxury timepieces.",
        link: "https://www.horando.de/en",
        image: "https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=800&q=80"
    }
]

export default function Portfolio() {
    return (
        <section id="work" className="py-32 px-4 max-w-7xl mx-auto transition-colors duration-500">
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
                className="text-center mb-20"
            >
                <h2 className="text-4xl md:text-6xl font-serif font-bold text-dark dark:text-white transition-colors duration-500 mb-4">
                    Selected Works
                </h2>
                <p className="text-xl text-dark/70 dark:text-gray-400 font-sans max-w-2xl mx-auto transition-colors duration-500">
                    A showcase of digital experiences, e-commerce platforms, and web applications designed with precision.
                </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-12">
                {projects.map((project, index) => (
                    <motion.a
                        key={index}
                        href={project.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        initial={{ opacity: 0, y: 50 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-50px" }}
                        transition={{ duration: 0.6, delay: (index % 3) * 0.1 }}
                        className="group block"
                    >
                        <div className="relative aspect-[4/3] rounded-2xl overflow-hidden mb-6 bg-gray-100 dark:bg-gray-800 transition-colors duration-500">
                            <img
                                src={project.image}
                                alt={project.title}
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-dark/0 group-hover:bg-dark/20 transition-colors duration-300" />

                            {/* Overlay Icon */}
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                <div className="w-16 h-16 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center text-dark shadow-xl transform scale-75 group-hover:scale-100 transition-transform duration-300">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="text-2xl font-serif font-bold text-dark dark:text-white group-hover:text-primary dark:group-hover:text-primary transition-colors duration-300">
                                    {project.title}
                                </h3>
                            </div>
                            <p className="text-sm font-bold uppercase tracking-widest text-primary mb-3">
                                {project.industry}
                            </p>
                            <p className="text-dark/70 dark:text-gray-400 font-sans font-light leading-relaxed">
                                {project.description}
                            </p>
                        </div>
                    </motion.a>
                ))}
            </div>
        </section>
    )
}
