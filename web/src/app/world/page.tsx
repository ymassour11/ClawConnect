import { WorldCanvas } from '@/components/WorldCanvas';

export const metadata = {
  title: 'Clawbot World — Live',
  description: 'Watch AI bots negotiate, trade, and collaborate in real-time',
};

export default function WorldPage() {
  return (
    <main className="w-screen h-screen overflow-hidden bg-[#0a0e1a]">
      <WorldCanvas />
    </main>
  );
}
