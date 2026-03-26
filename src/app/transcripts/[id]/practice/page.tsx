import PracticeClientWrapper from "./PracticeClientWrapper";

export default async function PracticeTranscriptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PracticeClientWrapper id={id} />;
}
