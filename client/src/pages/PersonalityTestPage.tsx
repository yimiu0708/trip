import { useEffect, useState } from 'react';
import { ArrowLeft, Check, ChevronLeft, Compass, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { PERSONALITY_QUESTIONS, type PersonalityAnswer } from '../lib/personality';

export default function PersonalityTestPage() {
  const navigate = useNavigate();
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const question = PERSONALITY_QUESTIONS[index];

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  const choose = (value: string) => {
    const next = { ...answers, [question.id]: value };
    setAnswers(next);
    setError('');
    window.setTimeout(() => {
      if (index < PERSONALITY_QUESTIONS.length - 1) setIndex((current) => current + 1);
      else submit(next);
    }, 180);
  };

  const submit = async (picked: Record<string, string>) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const payload: PersonalityAnswer[] = PERSONALITY_QUESTIONS.map((item) => ({ questionId: item.id, value: picked[item.id] }));
      const response = await api.personality.submit(payload);
      sessionStorage.setItem('trip_personality_new_achievements', JSON.stringify(response.newAchievements || []));
      navigate('/personality/result', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : '结果生成失败，请重试');
      setSubmitting(false);
    }
  };

  if (!started) {
    return (
      <div className="personality-page personality-intro-page">
        <button className="personality-back" type="button" onClick={() => navigate('/profile')} aria-label="返回我的"><ArrowLeft size={20} /></button>
        <section className="personality-intro-card">
          <div className="personality-orbit" aria-hidden="true"><img src="/images/shijie-logo-mark.png" alt="" /><Compass size={34} /></div>
          <p className="personality-eyebrow"><Sparkles size={15} /> 旅行身份探索</p>
          <h1>测测你的旅行人格</h1>
          <p>12 道轻松小题，看看你是哪种旅行者。</p>
          <div className="personality-intro-note"><Check size={16} />没有标准答案，选更像你的那个就好</div>
          <button className="personality-primary" type="button" onClick={() => setStarted(true)}>开始测试</button>
        </section>
      </div>
    );
  }

  return (
    <div className="personality-page personality-test-page">
      <header className="personality-test-head">
        <button type="button" onClick={() => index > 0 ? setIndex((current) => current - 1) : setStarted(false)} aria-label="返回上一题"><ChevronLeft size={21} /></button>
        <div><span>{index + 1} / {PERSONALITY_QUESTIONS.length}</span><div><i style={{ width: `${((index + 1) / PERSONALITY_QUESTIONS.length) * 100}%` }} /></div></div>
      </header>
      <main className="personality-question-card" key={question.id}>
        <p>选择更像你的回答</p>
        <h1>{question.prompt}</h1>
        <div className="personality-options">
          {question.options.map((option, optionIndex) => (
            <button
              key={option.value}
              type="button"
              className={answers[question.id] === option.value ? 'selected' : ''}
              onClick={() => choose(option.value)}
              disabled={submitting}
            >
              <span>{String.fromCharCode(65 + optionIndex)}</span><strong>{option.label}</strong>
              {answers[question.id] === option.value && <Check size={18} />}
            </button>
          ))}
        </div>
        {submitting && <div className="personality-generating">正在生成你的旅行人格...</div>}
        {error && <div className="personality-error">{error}</div>}
      </main>
    </div>
  );
}
