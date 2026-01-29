"use client";

import { useTranslations } from "next-intl";
import * as React from "react";
import Autoplay from "embla-carousel-autoplay";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight} from "lucide-react";
import { useThemeSection } from "@/hooks/useThemeSection";

export default function Activities() {
  const t = useTranslations("activities");
  const sectionRef = useThemeSection("#EEE8DC", "#1c1917");
  const [api, setApi] = React.useState<CarouselApi>();
  const [current, setCurrent] = React.useState(0);
  const [count, setCount] = React.useState(0);

  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Autoplay plugin instance ref
  const plugin = React.useRef(
    Autoplay({ delay: 5000, stopOnInteraction: false })
  );

  const scrollToTab = (index: number) => {
    const container = scrollRef.current;
    if (container) {
      const tab = container.children[index] as HTMLElement;
      if (tab) {
        // Calcular la posición para centrar el tab dentro del contenedor
        const containerWidth = container.clientWidth;
        const tabLeft = tab.offsetLeft;
        const tabWidth = tab.clientWidth;
        
        const scrollLeft = tabLeft - (containerWidth / 2) + (tabWidth / 2);
        
        container.scrollTo({
          left: scrollLeft,
          behavior: 'smooth'
        });
      }
    }
  };

  const handleSelect = (index: number) => {
    api?.scrollTo(index);
    plugin.current.reset();
    
    // Comportamiento "Manual": Usamos scrollIntoView que puede mover la página
    // Esto es lo que el usuario quería restaurar solo para interacciones manuales
    scrollRef.current?.children[index].scrollIntoView({ 
      behavior: 'smooth', 
      inline: 'center', 
      block: 'nearest' 
    });
  };

  React.useEffect(() => {
    if (!api) {
      return;
    }

    setCount(api.scrollSnapList().length);
    setCurrent(api.selectedScrollSnap() + 1);

    api.on("select", () => {
      const index = api.selectedScrollSnap();
      setCurrent(index + 1);
      // Comportamiento "Automático": Usamos nuestra función personalizada que SOLO mueve el scroll horizontal del contenedor
      // Esto evita que la página entera salte cuando pasa el autoplay
      scrollToTab(index);
    });
  }, [api]);

  const handlePrevious = () => {
    api?.scrollPrev();
    plugin.current.reset();
  };

  const handleNext = () => {
    api?.scrollNext();
    plugin.current.reset();
  };

  const activityItems = [
    {
      id: "board_games",
      color: "bg-amber-100",
      image: "🎲",
    },
    {
      id: "rpg",
      color: "bg-indigo-100",
      image: "🐉",
    },
    {
      id: "events",
      color: "bg-rose-100",
      image: "🏆",
    },
    {
      id: "egara",
      color: "bg-emerald-100",
      image: "🎉",
    },
  ];

  return (
    <section ref={sectionRef} id="activities" className="py-24 overflow-hidden">
      <div className="container mx-auto px-6">
        <div className="text-center mb-6">
          <h2 className="mb-6 text-4xl font-bold tracking-tight md:text-5xl">
            {t("title")}
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-xl leading-relaxed opacity-60">
            {t("text")}
          </p>
          <div className="flex items-center justify-center my-2">
            {/* Contenedor Píldora */}
            <div className="inline-flex items-center rounded-full bg-stone-100 p-1.5 shadow-sm max-w-[95vw] sm:max-w-full border border-stone-200 ">
              
              {/* Botón Anterior (Solo para mover el scroll de los botones) */}
              <button 
                onClick={() => handlePrevious() }
                className="rounded-full p-1.5 text-stone-500 hover:text-stone-900 transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              {/* Contenedor de Tabs con Scroll */}
              <div 
                ref={scrollRef}
                className="no-scrollbar flex overflow-x-auto py-1 px-1 sm:px-2 scroll-smooth snap-x snap-mandatory"
              >
                {activityItems.map((item, index) => {
                  const isActive = current === index + 1;
                  return (
                    <button
                      key={`tab-${item.id}`}
                      onClick={() => {
                        handleSelect(index);
                      }}
                      className={cn(
                        "whitespace-nowrap mx-0.5 sm:mx-1 px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-300 snap-center",
                        isActive 
                          ? "bg-stone-800 text-white shadow-md scale-105" 
                          : "bg-transparent text-stone-500 hover:text-stone-800"
                      )}
                    >
                      {t(`items.${item.id}.title`)}
                    </button>
                  );
                })}
              </div>

              {/* Botón Siguiente */}
              <button 
                onClick={() => handleNext() }
                className="rounded-full p-1.5 text-stone-500 hover:text-stone-900 transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="mx-auto">
          <Carousel
            setApi={setApi}
            plugins={[plugin.current]}
            className="w-full relative"
            opts={{
              loop: true,
            }}
          >
            <CarouselContent className="-ml-2 py-4 px-2">
              {activityItems.map((item) => (
                <CarouselItem key={item.id} className="basis-full">
                  <div className="flex flex-col md:flex-row items-center gap-8 md:gap-16">
                    {/* Image Area (Side) */}
                    <div className="w-full md:w-1/2">
                        <div className={cn("aspect-[4/3] w-full relative overflow-hidden rounded-[2rem] flex items-center justify-center transition-colors duration-500 shadow-lg", item.color)}>
                            <div className="text-[8rem] opacity-40 animate-pulse">
                                {item.image}
                            </div>
                        </div>
                    </div>

                    {/* Content Area (No background, integrated) */}
                    <div className="w-full md:w-1/2 text-left space-y-6">
                      <h3 className="text-4xl md:text-5xl font-bold">
                        {t(`items.${item.id}.title`)}
                      </h3>
                      <div className="h-1.5 w-20 rounded-full bg-stone-300"></div>
                      <p className="text-xl opacity-60 leading-relaxed">
                        {t(`items.${item.id}.description`)}
                      </p>
                    </div>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            
            {/* Arrows */}
            <button 
              onClick={handlePrevious}
              className="absolute left-0 top-0 h-full w-12 md:w-16 flex items-center justify-center text-stone-800 opacity-0 hover:opacity-100 transition-opacity duration-300 z-10 focus:outline-none"
              aria-label="Previous slide"
            >
              <ChevronLeft className="h-8 w-8 md:h-12 md:w-12 p-1" />
            </button>
            <button 
              onClick={handleNext}
              className="absolute right-0 top-0 h-full w-12 md:w-16 flex items-center justify-center text-stone-800 opacity-0 hover:opacity-100 transition-opacity duration-300 z-10 focus:outline-none"
              aria-label="Next slide"
            >
              <ChevronRight className="h-8 w-8 md:h-12 md:w-12 p-1" />
            </button>
            
          </Carousel>
        </div>
      </div>
    </section>
  );
}
