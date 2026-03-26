import EditTranscriptClient from "./EditTranscriptClient";

export default async function EditTranscriptPage({ params }: { params: Promise<{ id: string }> }) {
  // Server Component: unwrap params Promise and pass id as prop
  const { id } = await params;
  return <EditTranscriptClient id={id} />;
}
