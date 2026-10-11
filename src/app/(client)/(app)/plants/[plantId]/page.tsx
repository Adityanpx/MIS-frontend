import { redirect } from 'next/navigation';

export default async function PlantIndex({ params }: { params: Promise<{ plantId: string }> }) {
  const { plantId } = await params;
  redirect(`/plants/${plantId}/dashboard`);
}
