import { TextHoverEffect }  from "@/components/ui/text-hover-effect";
import { Audiowide } from 'next/font/google';

const audiowide = Audiowide({
  subsets: ['latin'],
  weight: '400',
});

export default function FullPageLoader() {
  return (
    <div className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black ${audiowide.className}`}>
      <div className="w-full flex flex-col items-center">
        <div className="w-full flex justify-center">
          <TextHoverEffect text="Infi" duration={2} />
        </div>
      </div>
    </div>
  );
} 