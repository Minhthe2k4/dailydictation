import Link from "next/link";
import { getServerSession } from "next-auth";
import { AuthButtons } from "@/components/AuthButtons";
import { authOptions } from "@/lib/auth";

export default async function Home() {
  const session = await getServerSession(authOptions);

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-[radial-gradient(circle_at_top_right,_#ffd9b8_0%,_#f7efe6_38%,_#d6ece9_100%)] px-6 py-10 text-[#12242b]">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col">
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-[#20545e]">Phòng Luyện Nghe - Chép Chính Tả</p>
            <h1 className="text-2xl font-black sm:text-3xl">Nghe, chép và tiến bộ mỗi ngày</h1>
          </div>
          <AuthButtons
            isAuthenticated={Boolean(session?.user?.id)}
            userName={session?.user?.name}
          />
        </header>

        <section className="mt-12 grid flex-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl bg-white/80 p-8 shadow-2xl backdrop-blur-sm ring-1 ring-black/5">
            <p className="inline-block rounded-full bg-[#0f3f42] px-4 py-1 text-xs font-semibold uppercase tracking-wide text-white">
              Ứng dụng React + Cơ sở dữ liệu
            </p>
            <h2 className="mt-5 text-4xl font-black leading-tight">
              Luyện chính tả tiếng Hàn với nhiều cấp độ
            </h2>
            <p className="mt-4 max-w-xl text-base text-[#32525a]">
              Đăng nhập Google để lưu lịch sử luyện tập, tính điểm tự động và xem tiến độ của bạn
              theo từng lần nghe và chép.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={session?.user?.id ? "/transcripts" : "#"}
                className="rounded-xl bg-[#f1893c] px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#de7a31]"
              >
                {session?.user?.id ? "Bắt đầu luyện nghe" : "Đăng nhập để bắt đầu"}
              </Link>
              <span className="rounded-xl border border-[#0f3f42] px-5 py-3 text-sm font-semibold text-[#0f3f42]">
                Giọng đọc: ko-KR
              </span>
            </div>
          </div>

          <div className="rounded-3xl bg-[#0f3f42] p-8 text-white shadow-2xl">
            <h3 className="text-2xl font-black">Có gì bên trong?</h3>
            <ul className="mt-4 space-y-3 text-sm text-[#d3eceb]">
              <li>Nghe câu tiếng Hàn bằng trình đọc giọng nói ko-KR.</li>
              <li>Chép lại nội dung và nộp bài để chấm điểm tự động.</li>
              <li>Lưu lịch sử kết quả vào cơ sở dữ liệu để theo dõi tiến bộ.</li>
              <li>Đăng ký, đăng nhập một chạm với tài khoản Google.</li>
            </ul>
            <p className="mt-8 rounded-2xl bg-white/10 p-4 text-sm text-[#effbfb]">
              Mẹo: nghe 2-3 lần, ghi từ khóa trước, sau đó hoàn thiện câu đầy đủ.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
