import { ArrowLeft, Check, Flag, MapPin } from 'lucide-react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useRecall } from '../context/RecallContext';

interface RecallStep {
  title: string;
  progressLabel: string;
  progress: number;
  index: number;
  backTo?: string;
  backLabel?: string;
}

const recallSteps: Record<string, RecallStep> = {
  '/recall': {
    title: '找回我的足迹',
    progressLabel: '第 1 站，共 4 站',
    progress: 0,
    index: 0,
  },
  '/recall/cities': {
    title: '选择城市',
    progressLabel: '第 2 站，共 4 站',
    progress: 33,
    index: 1,
    backTo: '/recall',
    backLabel: '返回引导页',
  },
  '/recall/confirm': {
    title: '确认景区',
    progressLabel: '第 3 站，共 4 站',
    progress: 66,
    index: 2,
    backTo: '/recall/cities',
    backLabel: '返回城市选择页',
  },
  '/recall/result': {
    title: '点亮完成',
    progressLabel: '第 4 站，共 4 站',
    progress: 100,
    index: 3,
  },
};

export default function RecallLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { selectedCities, selectedAttractionIds } = useRecall();
  const step = recallSteps[location.pathname] || recallSteps['/recall'];

  const routeNodes = [
    { label: '开始', detail: '准备找回' },
    { label: '城市', detail: selectedCities.length > 0 ? `${selectedCities.length} 个` : '待选择' },
    { label: '景区', detail: selectedAttractionIds.length > 0 ? `${selectedAttractionIds.length} 个` : '待确认' },
    { label: '完成', detail: step.index === 3 ? '已点亮' : '等待点亮' },
  ];

  return (
    <div className="recall-layout">
      <header className={`recall-flow-header${step.backTo ? '' : ' no-back'}${step.index === 0 ? ' intro' : ''}`}>
        {step.backTo && (
          <button
            type="button"
            className="recall-icon-btn"
            onClick={() => navigate(step.backTo!)}
            aria-label={step.backLabel}
          >
            <ArrowLeft size={20} aria-hidden="true" />
          </button>
        )}
        <div className="recall-flow-heading">
          <div className="recall-flow-title-row">
            <h1>{step.title}</h1>
            <span>{step.progressLabel}</span>
          </div>
          <div className="recall-route" aria-label="找回足迹流程进度">
            <MapPin className="recall-route-end start" size={18} aria-hidden="true" />
            <ol>
              {routeNodes.map((node, index) => (
                <li key={node.label} className={`${index < step.index ? 'complete' : ''}${index === step.index ? ' active' : ''}`}>
                  <span className="recall-route-node" aria-hidden="true">
                    {index < step.index ? <Check size={11} /> : index + 1}
                  </span>
                  <span className="recall-route-copy">
                    <strong>{node.label}</strong>
                    <small>{node.detail}</small>
                  </span>
                </li>
              ))}
            </ol>
            <Flag className="recall-route-end finish" size={17} aria-hidden="true" />
            <progress value={step.progress} max={100}>流程进度 {step.progress}%</progress>
          </div>
        </div>
      </header>

      <div className="recall-layout-content">
        <Outlet />
      </div>
    </div>
  );
}
