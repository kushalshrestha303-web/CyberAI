import { notFound } from 'next/navigation';
import App from '@/components/App';
import { topics, workflows } from '@/lib/content';
export default async function Page({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await params;
  const section = path[0] ?? 'dashboard';
  if (
    ![
      'dashboard',
      'intel',
      'universe',
      'learn',
      'workflow',
      'soc',
      'automation',
      'academy',
      'projects',
      'settings',
      'admin',
    ].includes(section) ||
    path.length > 2
  )
    notFound();
  if (section === 'learn' && !topics.some((t) => t.id === path[1])) notFound();
  if (section === 'workflow' && !workflows[path[1]]) notFound();
  if (section === 'intel' && path[1] && !/^CVE-\d{4}-\d{4,10}$/.test(path[1])) notFound();
  return <App section={section} id={path[1]} />;
}
