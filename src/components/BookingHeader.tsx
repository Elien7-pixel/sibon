const BookingHeader = () => {
  return (
    <header className="relative text-white p-6 md:p-8 rounded-b-lg shadow-lg mb-8 overflow-hidden">
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{ 
          backgroundImage: 'url(https://images.unsplash.com/photo-1521401830884-6c03c1c87ebb?q=80&w=2070&auto=format&fit=crop)'
        }}
      />
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      
      <div className="relative z-10 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center space-x-4">
            <img 
              src="/ingwelala-logo.jpeg" 
              alt="Ingwelala Logo" 
              className="h-14 w-14 md:h-16 md:w-16 rounded-lg bg-white p-1 object-contain"
            />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Ingwelala Booking</h1>
              <p className="text-sm md:text-base opacity-90">Book your exclusive Boma experience</p>
            </div>
          </div>
          <a 
            href="https://ingwelala.co.za" 
            target="_blank" 
            rel="noopener noreferrer"
            className="hidden md:inline-block text-white font-semibold py-2 px-4 border border-white rounded-lg hover:bg-white hover:text-foreground transition-colors"
          >
            Visit Site
          </a>
        </div>
      </div>
    </header>
  );
};

export default BookingHeader;
