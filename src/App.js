import { useState, useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import { db, auth } from './firebase'; // Импортируем db и auth из firebase.js
import { collection, getDocs, setDoc, doc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from 'firebase/auth';
import './styles.css';

// Компонент для хедера
function Header({ openModal, partnerName, partnerId, showNotification, logout }) {
  const copyPartnerId = () => {
    navigator.clipboard.writeText(partnerId).then(() => {
      showNotification('ID партнёра скопирован!');
    }).catch(() => {
      showNotification('Ошибка копирования ID!');
    });
  };

  return (
    <header className="header">
      <h1>
        <i className="fas fa-user" aria-hidden="true"></i> Добро пожаловать, {partnerName}
        <span className="partner-id" onClick={copyPartnerId} title="Копировать ID">
          ID: {partnerId}
        </span>
      </h1>
      <div className="header-controls">
        <button type="button" onClick={() => openModal('notifications-modal')} aria-label="Уведомления">
          <i className="fas fa-bell" aria-hidden="true"></i> Уведомления
        </button>
        <button type="button" onClick={logout} aria-label="Выйти">
          <i className="fas fa-sign-out-alt" aria-hidden="true"></i> Выйти
        </button>
      </div>
    </header>
  );
}

// Компонент для уведомления
function Notification({ message, isVisible, onHide }) {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onHide();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onHide]);

  return (
    <div
      id="notification"
      className={`notification animate__animated ${isVisible ? 'animate__fadeIn' : 'animate__fadeOut'}`}
      role="alert"
      style={{ display: isVisible || message ? 'block' : 'none' }}
    >
      {message}
    </div>
  );
}

// Компонент для карточки
function Card({ icon, title, children, modalId, openModal }) {
  return (
    <article
      className={`card ${modalId}-card`}
      onClick={() => openModal(modalId)}
      tabIndex="0"
      role="button"
      aria-label={`Открыть ${title.toLowerCase()}`}
    >
      <div className="card-accent"></div>
      <i className={`fas ${icon} card-icon`} aria-hidden="true"></i>
      <h2>{title}</h2>
      {children}
    </article>
  );
}

// Компонент для модального окна
function Modal({ id, title, children, isOpen, onClose, isLoading }) {
  if (!isOpen) return null;

  return (
    <div id={id} className="modal" role="dialog" aria-labelledby={`${id}-title`}>
      <div className={`modal-content ${isLoading ? 'blurred' : ''}`}>
        <button className="close" onClick={onClose} aria-label="Закрыть">
          ×
        </button>
        <div className="loader" style={{ display: isLoading ? 'block' : 'none' }}></div>
        <h2 id={`${id}-title`}>{title}</h2>
        <article className="card">{children}</article>
      </div>
    </div>
  );
}

// Главный компонент
export default function App() {
  const [openModalId, setOpenModalId] = useState(null);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationVisible, setNotificationVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);

  // Данные
  const [referrals, setReferrals] = useState([]);
  const [referralStats, setReferralStats] = useState([]);
  const [financeStats, setFinanceStats] = useState([]);
  const [promoCodes, setPromoCodes] = useState([]);
  const [activityData, setActivityData] = useState([]);

  // Фильтры и состояния
  const [periodFilter, setPeriodFilter] = useState('month');
  const [tariffFilter, setTariffFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [referralPeriodFilter, setReferralPeriodFilter] = useState('all');
  const [financePeriodFilter, setFinancePeriodFilter] = useState('all');
  const [showWithdrawalButtons, setShowWithdrawalButtons] = useState(false);
  const [activityPeriodFilter, setActivityPeriodFilter] = useState('all');
  const [activityActionFilter, setActivityActionFilter] = useState('all');
  const [activityIdFilter, setActivityIdFilter] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [partnerEmail, setPartnerEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Графики
  const incomeChartRef = useRef(null);
  const funnelChartRef = useRef(null);
  const referralChartRef = useRef(null);
  const financeChartRef = useRef(null);
  const chartInstances = useRef({});

  // Инициализация данных, если они отсутствуют
  const initializeUserData = async (userId) => {
    const defaultReferrals = [
      { id: '001', plan: 'Премиум', amount: '50,000 ₸', date: '01.03.2025', status: 'Активен', source: 'Соцсети' },
      { id: '002', plan: 'Стандарт', amount: '20,000 ₸', date: '02.03.2025', status: 'Неактивен', source: 'Сайт' },
    ];
    const defaultReferralStats = [
      { date: '01.03.2025', source: 'Соцсети', unique: 'Да', result: 'Регистрация' },
      { date: '02.03.2025', source: 'Сайт', unique: 'Нет', result: 'Нет' },
    ];
    const defaultFinanceStats = [
      { date: '10.02.2025', amount: '30,000 ₸', status: 'Выплачено' },
      { date: '15.01.2025', amount: '45,000 ₸', status: 'Выплачено' },
      { date: '05.03.2025', amount: '20,000 ₸', status: 'Ожидает' },
      { date: '03.03.2025', amount: '15,000 ₸', status: 'Отменено' },
    ];
    const defaultPromoCodes = [
      { code: 'PARTNER10', uses: 25, registrations: 10, revenue: '50,000 ₸', created: '01.03.2025' }
    ];
    const defaultActivityData = [
      { id: '001', action: 'registration', date: '01.03.2025', source: 'Соцсети', revenue: '0 ₸' },
      { id: '001', action: 'purchase', date: '02.03.2025', source: 'PARTNER10', revenue: '50,000 ₸' },
      { id: '002', action: 'registration', date: '03.03.2025', source: 'Сайт', revenue: '0 ₸' }
    ];

    await setDoc(doc(db, `users/${userId}/referrals`, 'data'), { items: defaultReferrals });
    await setDoc(doc(db, `users/${userId}/referralStats`, 'data'), { items: defaultReferralStats });
    await setDoc(doc(db, `users/${userId}/financeStats`, 'data'), { items: defaultFinanceStats });
    await setDoc(doc(db, `users/${userId}/promoCodes`, 'data'), { items: defaultPromoCodes });
    await setDoc(doc(db, `users/${userId}/activityData`, 'data'), { items: defaultActivityData });
  };

  // Загружаем данные из Firestore
  useEffect(() => {
    if (user) {
      const loadData = async () => {
        const referralsSnapshot = await getDocs(collection(db, `users/${user.uid}/referrals`));
        const referralsData = referralsSnapshot.docs.map(doc => doc.data().items).flat();
        if (referralsData.length === 0) {
          await initializeUserData(user.uid);
          setReferrals(defaultReferrals);
        } else {
          setReferrals(referralsData);
        }

        const referralStatsSnapshot = await getDocs(collection(db, `users/${user.uid}/referralStats`));
        setReferralStats(referralStatsSnapshot.docs.map(doc => doc.data().items).flat() || []);

        const financeStatsSnapshot = await getDocs(collection(db, `users/${user.uid}/financeStats`));
        setFinanceStats(financeStatsSnapshot.docs.map(doc => doc.data().items).flat() || []);

        const promoCodesSnapshot = await getDocs(collection(db, `users/${user.uid}/promoCodes`));
        setPromoCodes(promoCodesSnapshot.docs.map(doc => doc.data().items).flat() || []);

        const activityDataSnapshot = await getDocs(collection(db, `users/${user.uid}/activityData`));
        setActivityData(activityDataSnapshot.docs.map(doc => doc.data().items).flat() || []);
      };
      loadData();
    }
  }, [user]);

  // Сохраняем данные в Firestore
  const saveData = async (collectionName, data) => {
    if (user) {
      await setDoc(doc(db, `users/${user.uid}/${collectionName}`, 'data'), { items: data });
    }
  };

  useEffect(() => {
    saveData('referrals', referrals);
  }, [referrals]);

  useEffect(() => {
    saveData('referralStats', referralStats);
  }, [referralStats]);

  useEffect(() => {
    saveData('financeStats', financeStats);
  }, [financeStats]);

  useEffect(() => {
    saveData('promoCodes', promoCodes);
  }, [promoCodes]);

  useEffect(() => {
    saveData('activityData', activityData);
  }, [activityData]);

  // Отслеживаем состояние авторизации
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setIsAuthenticated(true);
        setPartnerName(currentUser.displayName || 'Иван Иванов');
        setPartnerEmail(currentUser.email);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const getChartData = (period) => {
    const data = {
      day: { labels: ['Пн', 'Вт', 'Ср'], values: [10000, 15000, 12000] },
      week: { labels: ['Нед 1', 'Нед 2', 'Нед 3'], values: [30000, 45000, 20000] },
      month: { labels: ['Янв', 'Фев', 'Мар'], values: [30000, 45000, 20000] },
      year: { labels: ['2023', '2024', '2025'], values: [100000, 120000, 150000] },
    }[period] || { labels: ['Янв', 'Фев', 'Мар'], values: [30000, 45000, 20000] };
    return data;
  };

  const getReferralChartData = (period) => {
    const data = {
      '7': { labels: ['День 1', 'День 2', 'День 7'], values: [20, 30, 25] },
      '30': { labels: ['Нед 1', 'Нед 2', 'Нед 4'], values: [50, 60, 40] },
      'all': { labels: ['Янв', 'Фев', 'Мар'], values: [80, 120, 150] },
    }[period] || { labels: ['Янв', 'Фев', 'Мар'], values: [80, 120, 150] };
    return data;
  };

  const getFinanceChartData = (period) => {
    const data = {
      '7': { labels: ['День 1', 'День 2', 'День 7'], values: [10000, 15000, 12000] },
      '30': { labels: ['Нед 1', 'Нед 2', 'Нед 4'], values: [30000, 45000, 20000] },
      'all': { labels: ['Янв', 'Фев', 'Мар'], values: [50000, 75000, 95000] },
    }[period] || { labels: ['Янв', 'Фев', 'Мар'], values: [50000, 75000, 95000] };
    return data;
  };

  const renderChart = (canvasRef, config, chartKey) => {
    if (!canvasRef.current) return;

    if (chartInstances.current[chartKey]) {
      chartInstances.current[chartKey].destroy();
    }

    const ctx = canvasRef.current.getContext('2d');
    chartInstances.current[chartKey] = new Chart(ctx, config);
  };

  useEffect(() => {
    if (openModalId === 'dashboard-modal' && !isLoading) {
      const incomeData = getChartData(periodFilter);
      renderChart(incomeChartRef, {
        type: 'line',
        data: {
          labels: incomeData.labels,
          datasets: [{
            label: 'Доход (₸)',
            data: incomeData.values,
            borderColor: '#007bff',
            fill: false,
            tension: 0.4,
          }],
        },
        options: {
          responsive: true,
          scales: {
            y: { beginAtZero: true, ticks: { color: '#6c757d' } },
            x: { ticks: { color: '#6c757d' } },
          },
          plugins: {
            legend: { labels: { color: '#343a40' } },
            tooltip: { enabled: true, mode: 'index', intersect: false }
          },
        },
      }, 'incomeChart');

      renderChart(funnelChartRef, {
        type: 'bar',
        data: {
          labels: ['Клики', 'Регистрации', 'Оплаты'],
          datasets: [{
            label: 'Воронка',
            data: [150, 42, 15],
            backgroundColor: ['#007bff', '#6c757d', '#22c55e'],
          }],
        },
        options: {
          responsive: true,
          indexAxis: 'y',
          scales: {
            x: { beginAtZero: true, ticks: { color: '#6c757d' } },
            y: { ticks: { color: '#6c757d' } },
          },
          plugins: { legend: { display: false } },
        },
      }, 'funnelChart');
    }

    if (openModalId === 'referral-modal' && !isLoading) {
      const referralData = getReferralChartData(referralPeriodFilter);
      renderChart(referralChartRef, {
        type: 'line',
        data: {
          labels: referralData.labels,
          datasets: [{
            label: 'Клики',
            data: referralData.values,
            borderColor: '#007bff',
            fill: false,
            tension: 0.4,
          }],
        },
        options: {
          responsive: true,
          scales: {
            y: { beginAtZero: true, ticks: { color: '#6c757d' } },
            x: { ticks: { color: '#6c757d' } },
          },
          plugins: { legend: { labels: { color: '#343a40' } } },
        },
      }, 'referralChart');
    }

    if (openModalId === 'finance-modal' && !isLoading) {
      const financeData = getFinanceChartData(financePeriodFilter);
      renderChart(financeChartRef, {
        type: 'line',
        data: {
          labels: financeData.labels,
          datasets: [{
            label: 'Доход (₸)',
            data: financeData.values,
            borderColor: '#007bff',
            fill: false,
            tension: 0.4,
          }],
        },
        options: {
          responsive: true,
          scales: {
            y: { beginAtZero: true, ticks: { color: '#6c757d' } },
            x: { ticks: { color: '#6c757d' } },
          },
          plugins: { legend: { labels: { color: '#343a40' } } },
        },
      }, 'financeChart');
    }

    return () => {
      Object.values(chartInstances.current).forEach(chart => chart.destroy());
    };
  }, [openModalId, isLoading, periodFilter, referralPeriodFilter, financePeriodFilter]);

  // Функции уведомлений
  const showNotification = (message) => {
    setNotificationMessage(message);
    setNotificationVisible(true);
  };

  const hideNotification = () => {
    setNotificationVisible(false);
    setNotificationMessage('');
  };

  // Открытие/закрытие модалок
  const openModal = (modalId) => {
    setOpenModalId(modalId);
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      if (modalId === 'finance-modal') {
        updateWithdrawalButtons();
      }
    }, 1000);
  };

  const closeModal = () => {
    setOpenModalId(null);
    setIsLoading(false);
  };

  // Функции авторизации
  const handleRegister = async (event) => {
    event.preventDefault();
    const name = event.target['reg-name'].value;
    const email = event.target['reg-email'].value;
    const password = event.target['reg-password'].value;

    if (!name || !email || !password) {
      showNotification('Заполните все поля!');
      return;
    }
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      showNotification('Некорректный email!');
      return;
    }
    if (password.length < 8) {
      showNotification('Пароль должен быть минимум 8 символов!');
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName: name });
      await initializeUserData(userCredential.user.uid);
      setOpenModalId(null);
      showNotification('Регистрация успешна!');
    } catch (error) {
      showNotification('Ошибка регистрации: ' + error.message);
    }
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    const email = event.target['login-email'].value;
    const password = event.target['login-password'].value;

    try {
      await signInWithEmailAndPassword(auth, email, password);
      showNotification('Вход выполнен!');
    } catch (error) {
      showNotification('Ошибка входа: ' + error.message);
    }
  };

  const handleLogout = async () => {
    if (window.confirm('Вы уверены, что хотите выйти?')) {
      await signOut(auth);
      showNotification('Выход выполнен!');
    }
  };

  // Фильтрация рефералов
  const filteredReferrals = referrals.filter((referral) => {
    const matchesSearch = referral.id.includes(searchQuery) ||
      referral.plan.toLowerCase().includes(searchQuery.toLowerCase()) ||
      referral.date.includes(searchQuery);
    const matchesTariff = tariffFilter === 'all' || referral.plan.toLowerCase() === tariffFilter;
    const matchesStatus = statusFilter === 'all' || referral.status.toLowerCase() === statusFilter;
    return matchesSearch && matchesTariff && matchesStatus;
  });

  // Экспорт в Excel для рефералов
  const exportToExcel = () => {
    const headers = ['ID,Тариф,Сумма,Дата,Статус,Источник'];
    const rows = filteredReferrals.map(r => `${r.id},${r.plan},${r.amount},${r.date},${r.status},${r.source}`);
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'referrals.xlsx');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('Данные экспортированы в Excel!');
  };

  // Функции для реферальной ссылки
  const copyLink = () => {
    const link = 'https://example.com/ref/partner123';
    navigator.clipboard.writeText(link).then(() => {
      showNotification('Ссылка скопирована!');
    }).catch(() => {
      showNotification('Ошибка копирования!');
    });
  };

  const filteredReferralStats = referralStats.filter(stat => {
    const statDate = new Date(stat.date.split('.').reverse().join('-'));
    const now = new Date();
    if (referralPeriodFilter === '7') {
      return statDate > new Date(now - 7 * 24 * 60 * 60 * 1000);
    }
    if (referralPeriodFilter === '30') {
      return statDate > new Date(now - 30 * 24 * 60 * 60 * 1000);
    }
    return true;
  });

  const exportReferralStats = () => {
    const headers = ['Дата клика,Источник,Уникальный,Результат'];
    const rows = filteredReferralStats.map(r => `${r.date},${r.source},${r.unique},${r.result}`);
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'referral_stats.xlsx');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('Статистика экспортирована в Excel!');
  };

  // Функции для финансов
  const filteredFinanceStats = financeStats.filter(stat => {
    const statDate = new Date(stat.date.split('.').reverse().join('-'));
    const now = new Date();
    if (financePeriodFilter === '7') {
      return statDate > new Date(now - 7 * 24 * 60 * 60 * 1000);
    }
    if (financePeriodFilter === '30') {
      return statDate > new Date(now - 30 * 24 * 60 * 60 * 1000);
    }
    return true;
  });

  const updateWithdrawalButtons = () => {
    const hasPendingWithdrawal = filteredFinanceStats.some(w => w.status === 'Ожидает');
    setShowWithdrawalButtons(hasPendingWithdrawal);
  };

  const exportFinanceStats = () => {
    const headers = ['Дата,Сумма,Статус'];
    const rows = filteredFinanceStats.map(r => `${r.date},${r.amount},${r.status}`);
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'finance_stats.xlsx');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('История выплат экспортирована в Excel!');
  };

  // Функции для промокодов
  const copyPromoCode = (code) => {
    navigator.clipboard.writeText(code).then(() => {
      showNotification(`Промокод ${code} скопирован!`);
    }).catch(() => {
      showNotification('Ошибка копирования!');
    });
  };

  const createPromoCode = () => {
    const newPromo = document.getElementById('new-promo')?.value?.trim();
    if (!/^[a-zA-Z0-9]{6,15}$/.test(newPromo)) {
      showNotification('Промокод должен содержать 6-15 букв и/или цифр без пробелов!');
      return;
    }

    if (promoCodes.find(p => p.code === newPromo)) {
      showNotification('Этот промокод уже существует!');
      return;
    }

    if (promoCodes.length >= 3) {
      showNotification('Достигнут лимит в 3 промокода! Удалите один, чтобы добавить новый.');
      return;
    }

    setPromoCodes([...promoCodes, {
      code: newPromo,
      uses: 0,
      registrations: 0,
      revenue: '0 ₸',
      created: new Date().toLocaleDateString('ru-RU')
    }]);
    showNotification(`Промокод ${newPromo} создан!`);
  };

  const deletePromoCode = (index) => {
    const promo = promoCodes[index];
    if (window.confirm(`Удалить промокод ${promo.code}?`)) {
      setPromoCodes(promoCodes.filter((_, i) => i !== index));
      showNotification(`Промокод ${promo.code} удалён!`);
    }
  };

  // Функции для активности
  const filteredActivityData = activityData.filter(r => {
    const statDate = new Date(r.date.split('.').reverse().join('-'));
    const now = new Date();
    const matchesPeriod = activityPeriodFilter === 'all' ||
      (activityPeriodFilter === '7' && statDate > new Date(now - 7 * 24 * 60 * 60 * 1000)) ||
      (activityPeriodFilter === '30' && statDate > new Date(now - 30 * 24 * 60 * 60 * 1000));
    const matchesAction = activityActionFilter === 'all' || r.action === activityActionFilter;
    const matchesId = !activityIdFilter || r.id.toLowerCase().includes(activityIdFilter.toLowerCase());
    return matchesPeriod && matchesAction && matchesId;
  });

  // Функции для настроек
  const saveSettings = async (event) => {
    event.preventDefault();
    const name = partnerName.trim();
    const email = partnerEmail.trim();

    if (!name) {
      showNotification('Введите имя!');
      return;
    }
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      showNotification('Некорректный email!');
      return;
    }
    if (currentPassword || newPassword || confirmPassword) {
      if (!currentPassword) {
        showNotification('Введите текущий пароль!');
        return;
      }
      if (newPassword.length < 8) {
        showNotification('Новый пароль должен содержать минимум 8 символов!');
        return;
      }
      if (newPassword !== confirmPassword) {
        showNotification('Пароли не совпадают!');
        return;
      }
      // Здесь можно добавить обновление пароля через Firebase Auth
    }

    try {
      await updateProfile(auth.currentUser, { displayName: name });
      setPartnerName(name);
      showNotification('Настройки сохранены!');
    } catch (error) {
      showNotification('Ошибка сохранения настроек: ' + error.message);
    }
  };

  // Экран логина
  if (!isAuthenticated) {
    return (
      <div className="container">
        <div className="main-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
          <h2>Вход</h2>
          <form onSubmit={handleLogin} style={{ maxWidth: '400px', width: '100%', padding: '20px', background: '#fff', borderRadius: '12px', boxShadow: 'var(--shadow-light)' }}>
            <label>
              Email:
              <input
                type="email"
                id="login-email"
                required
                aria-label="Электронная почта"
                placeholder="Введите ваш email"
              />
            </label>
            <label>
              Пароль:
              <input
                type="password"
                id="login-password"
                required
                aria-label="Пароль"
                placeholder="Введите ваш пароль"
              />
            </label>
            <button type="submit" className="action-button" style={{ marginTop: '15px' }}>
              Войти
            </button>
            <button
              type="button"
              className="action-button"
              style={{ marginTop: '10px', background: '#6c757d' }}
              onClick={() => openModal('register-modal')}
            >
              Регистрация
            </button>
          </form>

          {/* Модалка регистрации */}
          <Modal
            id="register-modal"
            title="Регистрация"
            isOpen={openModalId === "register-modal"}
            onClose={closeModal}
            isLoading={isLoading}
          >
            <form onSubmit={handleRegister}>
              <label>
                Имя:
                <input
                  type="text"
                  id="reg-name"
                  required
                  aria-label="Имя"
                  placeholder="Введите ваше имя"
                />
              </label>
              <label>
                Email:
                <input
                  type="email"
                  id="reg-email"
                  required
                  aria-label="Электронная почта"
                  placeholder="Введите ваш email"
                />
              </label>
              <label>
                Пароль:
                <input
                  type="password"
                  id="reg-password"
                  required
                  minLength="8"
                  aria-label="Пароль"
                  placeholder="Минимум 8 символов"
                />
              </label>
              <button type="submit" className="action-button" style={{ marginTop: '15px' }}>
                Зарегистрироваться
              </button>
            </form>
          </Modal>

          <Notification
            message={notificationMessage}
            isVisible={notificationVisible}
            onHide={hideNotification}
          />
        </div>
      </div>
    );
  }

  // Основной dashboard
  return (
    <div className="container">
      <main className="main-content">
        <Header
          openModal={openModal}
          partnerName={partnerName}
          partnerId="P12345"
          showNotification={showNotification}
          logout={handleLogout}
        />
        <Notification
          message={notificationMessage}
          isVisible={notificationVisible}
          onHide={hideNotification}
        />
        <section className="dashboard" aria-label="Панель управления">
          <Card icon="fa-chart-line" title="Статистика" modalId="dashboard-modal" openModal={openModal}>
            <p>Общий доход: 150,000 ₸</p>
            <p>Рефералов: 42</p>
          </Card>
          <Card icon="fa-link" title="Реферальная ссылка" modalId="referral-modal" openModal={openModal}>
            <p id="ref-link-main">https://example.com/ref/partner123</p>
          </Card>
          <Card icon="fa-wallet" title="Финансы" modalId="finance-modal" openModal={openModal}>
            <p>Доступно: 50,000 ₸</p>
          </Card>
          <Card icon="fa-headset" title="Поддержка" modalId="support-modal" openModal={openModal}>
            <p>Свяжитесь с нами</p>
          </Card>
          <Card icon="fa-ticket-alt" title="Мои промокоды" modalId="marketing-modal" openModal={openModal}>
            <p>Управление и статистика</p>
          </Card>
          <Card icon="fa-history" title="История активности" modalId="activity-modal" openModal={openModal}>
            <p>Действия рефералов: 85</p>
          </Card>
          <Card icon="fa-cog" title="Настройки" modalId="settings-modal" openModal={openModal}>
            <p>Управление профилем</p>
          </Card>
          <Card icon="fa-book" title="Обучение и FAQ" modalId="training-modal" openModal={openModal}>
            <p>Полезные материалы</p>
          </Card>
        </section>

        {/* Модалка "Статистика" */}
        <Modal
          id="dashboard-modal"
          title="Статистика"
          isOpen={openModalId === "dashboard-modal"}
          onClose={closeModal}
          isLoading={isLoading}
        >
          <div className="filters">
            <label>
              Период:
              <select
                id="period-filter"
                value={periodFilter}
                onChange={(e) => setPeriodFilter(e.target.value)}
              >
                <option value="day">День</option>
                <option value="week">Неделя</option>
                <option value="month">Месяц</option>
                <option value="year">Год</option>
              </select>
            </label>
            <label>
              Тариф:
              <select
                id="tariff-filter"
                value={tariffFilter}
                onChange={(e) => setTariffFilter(e.target.value)}
              >
                <option value="all">Все</option>
                <option value="premium">Премиум</option>
                <option value="standard">Стандарт</option>
              </select>
            </label>
            <label>
              Статус:
              <select
                id="status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Все</option>
                <option value="active">Активен</option>
                <option value="inactive">Неактивен</option>
              </select>
            </label>
          </div>
          <div className="dashboard modal-dashboard">
            <article className="card">
              <h3>Доход за период</h3>
              <div id="incomeChartContainer">
                <canvas id="incomeChart" ref={incomeChartRef} aria-label="График дохода за выбранный период"></canvas>
              </div>
            </article>
            <article className="card">
              <h3>Воронка конверсии</h3>
              <canvas id="funnelChart" ref={funnelChartRef} aria-label="Воронка конверсии"></canvas>
            </article>
            <article className="card">
              <h3>Рефералы</h3>
              <label htmlFor="referral-search" className="visually-hidden">
                Поиск рефералов
              </label>
              <input
                type="text"
                id="referral-search"
                placeholder="Поиск по ID, тарифу, дате"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Поиск рефералов"
              />
              <table className="referral-table" aria-label="Таблица рефералов">
                <thead>
                  <tr>
                    <th scope="col">ID</th>
                    <th scope="col">Тариф</th>
                    <th scope="col">Сумма</th>
                    <th scope="col">Дата</th>
                    <th scope="col">Статус</th>
                    <th scope="col">Источник</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReferrals.map((referral, index) => (
                    <tr key={index}>
                      <td>{referral.id}</td>
                      <td>{referral.plan}</td>
                      <td>{referral.amount}</td>
                      <td>{referral.date}</td>
                      <td>{referral.status}</td>
                      <td>{referral.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <table className="stats-table" aria-label="Статистика рефералов">
                <thead>
                  <tr>
                    <th>Метрика</th>
                    <th>Значение</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>Кликов по ссылке</td><td>150</td></tr>
                  <tr><td>Регистраций</td><td>42 (28% от кликов)</td></tr>
                  <tr><td>Оплат</td><td>15 (35.7% от регистраций)</td></tr>
                  <tr><td>Общая конверсия (клики → оплаты)</td><td>10%</td></tr>
                  <tr><td>Доход от регистраций</td><td>30,000 ₸</td></tr>
                  <tr><td>Доход от покупок</td><td>120,000 ₸</td></tr>
                  <tr><td>Средний доход на оплату</td><td>10,000 ₸</td></tr>
                  <tr><td>Среднее время до оплаты</td><td>3 дня</td></tr>
                  <tr><td>Доход по месяцам</td><td>Фев (120,000 ₸), Янв (100,000 ₸)</td></tr>
                  <tr><td>Прогноз дохода за месяц</td><td>180,000 ₸</td></tr>
                  <tr><td>Сравнение с прошлым</td><td>+20% к доходу</td></tr>
                </tbody>
              </table>
              <button type="button" onClick={exportToExcel} style={{ marginTop: "15px" }}>
                <i className="fas fa-file-excel" aria-hidden="true"></i> Экспорт в Excel
              </button>
            </article>
          </div>
        </Modal>

        {/* Модалка "Реферальная ссылка" */}
        <Modal
          id="referral-modal"
          title="Реферальная ссылка"
          isOpen={openModalId === "referral-modal"}
          onClose={closeModal}
          isLoading={isLoading}
        >
          <div className="link-container">
            <p id="ref-link" className="link-text">https://example.com/ref/partner123</p>
            <i className="fas fa-copy copy-icon" onClick={copyLink} title="Копировать ссылку"></i>
          </div>
          <p className="stats-header">Общая статистика</p>
          <p>Общее количество переходов: 150</p>
          <p>Количество оплаченных подписок: 15</p>
          <p>Конверсия в регистрации: 28%</p>
          <p>Конверсия в оплаты: 10%</p>
          <label>
            Период:
            <select
              id="referral-period-filter"
              value={referralPeriodFilter}
              onChange={(e) => setReferralPeriodFilter(e.target.value)}
            >
              <option value="7">Последние 7 дней</option>
              <option value="30">Последние 30 дней</option>
              <option value="all">Все время</option>
            </select>
          </label>
          <table className="stats-table" aria-label="Статистика переходов">
            <thead>
              <tr>
                <th>Дата клика</th>
                <th>Источник</th>
                <th>Уникальный</th>
                <th>Результат</th>
              </tr>
            </thead>
            <tbody>
              {filteredReferralStats.map((stat, index) => (
                <tr key={index}>
                  <td>{stat.date}</td>
                  <td>{stat.source}</td>
                  <td>{stat.unique}</td>
                  <td>{stat.result}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <canvas id="referralChart" ref={referralChartRef} style={{ maxHeight: "200px" }} aria-label="График кликов"></canvas>
          <button type="button" onClick={exportReferralStats} style={{ marginTop: "15px" }} className="action-button">
            <i className="fas fa-file-excel" aria-hidden="true"></i> Экспорт статистики в Excel
          </button>
        </Modal>

        {/* Модалка "Финансы" */}
        <Modal
          id="finance-modal"
          title="Финансы"
          isOpen={openModalId === "finance-modal"}
          onClose={closeModal}
          isLoading={isLoading}
        >
          <table className="finance-stats-table" aria-label="Финансовая статистика">
            <thead>
              <tr>
                <th>Параметр</th>
                <th>Значение</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Доступно для вывода</td><td className="stat-value">50,000 ₸</td></tr>
              <tr><td>В обработке</td><td className="stat-value">20,000 ₸</td></tr>
              <tr><td>Заблокировано</td><td className="stat-value">0 ₸</td></tr>
              <tr><td>Общий доход</td><td className="stat-value">200,000 ₸</td></tr>
              <tr><td>Доход за месяц</td><td className="stat-value">150,000 ₸</td></tr>
              <tr><td>Прогноз дохода за месяц</td><td className="stat-value">180,000 ₸</td></tr>
              <tr><td>Средний доход на реферала</td><td className="stat-value">10,000 ₸</td></tr>
            </tbody>
          </table>
          <label>
            Период:
            <select
              id="finance-period-filter"
              value={financePeriodFilter}
              onChange={(e) => setFinancePeriodFilter(e.target.value)}
            >
              <option value="7">Последние 7 дней</option>
              <option value="30">Последние 30 дней</option>
              <option value="all">Все время</option>
            </select>
          </label>
          <canvas id="financeChart" ref={financeChartRef} style={{ maxHeight: "200px" }} aria-label="График доходов"></canvas>
          <div className="withdrawal-actions">
            <button
              type="button"
              id="request-withdrawal-btn"
              className="action-button"
              onClick={() => openModal('withdrawal-form-modal')}
              style={{ display: showWithdrawalButtons ? 'none' : 'block' }}
            >
              <i className="fas fa-money-check-alt" aria-hidden="true"></i> Запросить вывод
            </button>
            <div id="withdrawal-buttons" style={{ display: showWithdrawalButtons ? 'flex' : 'none' }}>
              <button
                type="button"
                id="cancel-withdrawal-btn"
                className="action-button cancel"
                onClick={() => openModal('cancel-withdrawal-modal')}
              >
                <i className="fas fa-times" aria-hidden="true"></i> Отменить запрос на вывод
              </button>
              <button
                type="button"
                id="add-withdrawal-btn"
                className="action-button"
                onClick={() => openModal('withdrawal-form-modal')}
              >
                <i className="fas fa-plus" aria-hidden="true"></i> Добавить запрос на вывод
              </button>
            </div>
          </div>
          <p className="stats-header">История выплат</p>
          <table className="stats-table" aria-label="История выплат">
            <thead>
              <tr>
                <th data-column="date">Дата</th>
                <th data-column="amount">Сумма</th>
                <th data-column="status">Статус</th>
              </tr>
            </thead>
            <tbody>
              {filteredFinanceStats.map((stat, index) => (
                <tr key={index}>
                  <td>{stat.date}</td>
                  <td>{stat.amount}</td>
                  <td className={`status-${stat.status.toLowerCase()}`}>{stat.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" onClick={exportFinanceStats} style={{ marginTop: "15px" }} className="action-button">
            <i className="fas fa-file-excel" aria-hidden="true"></i> Экспорт истории в Excel
          </button>
        </Modal>

        {/* Модалка "Поддержка" */}
        <Modal
          id="support-modal"
          title="Поддержка"
          isOpen={openModalId === "support-modal"}
          onClose={closeModal}
          isLoading={isLoading}
        >
          <div className="support-info">
            <p className="work-hours">Часы работы: 9:00 - 18:00 (Пн-Пт)</p>
          </div>
          <div className="support-buttons">
            <button
              type="button"
              className="support-button telegram"
              onClick={() => window.open('https://t.me/support_channel', '_blank')}
            >
              <i className="fab fa-telegram-plane" aria-hidden="true"></i> Telegram
            </button>
            <button
              type="button"
              className="support-button whatsapp"
              onClick={() => window.open('https://wa.me/71234567890', '_blank')}
            >
              <i className="fab fa-whatsapp-square" aria-hidden="true"></i> WhatsApp
            </button>
          </div>
        </Modal>

        {/* Модалка "Отмена вывода" */}
        <Modal
          id="cancel-withdrawal-modal"
          title="Отменить запрос на вывод"
          isOpen={openModalId === "cancel-withdrawal-modal"}
          onClose={closeModal}
          isLoading={isLoading}
        >
          <p className="stats-header">Выберите транзакции для отмены</p>
          <table className="stats-table" aria-label="Не подтверждённые транзакции">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Сумма</th>
                <th>Выбрать</th>
              </tr>
            </thead>
            <tbody>
              {filteredFinanceStats.filter(w => w.status === 'Ожидает').map((w, index) => (
                <tr key={index}>
                  <td>{w.date}</td>
                  <td>{w.amount}</td>
                  <td><input type="checkbox" name="withdrawal" value={w.amount.replace(' ₸', '')} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            type="button"
            onClick={() => {
              const selectedWithdrawals = Array.from(document.querySelectorAll('input[name="withdrawal"]:checked'))
                .map(checkbox => checkbox.value);
              if (selectedWithdrawals.length === 0) {
                showNotification('Выберите хотя бы одну транзакцию для отмены!');
                return;
              }
              if (window.confirm(`Вы уверены, что хотите отменить выбранные запросы на вывод на сумму ${selectedWithdrawals.join(', ')} ₸?`)) {
                setFinanceStats(financeStats.map(stat => 
                  selectedWithdrawals.includes(stat.amount.replace(' ₸', '')) ? { ...stat, status: 'Отменено' } : stat
                ));
                updateWithdrawalButtons();
                showNotification('Выбранные запросы на вывод отменены.');
                closeModal();
              }
            }}
            className="action-button"
            style={{ marginTop: "15px" }}
          >
            <i className="fas fa-check" aria-hidden="true"></i> Подтвердить отмену
          </button>
        </Modal>

        {/* Модалка "Запрос на вывод" */}
        <Modal
          id="withdrawal-form-modal"
          title="Запрос на вывод"
          isOpen={openModalId === "withdrawal-form-modal"}
          onClose={closeModal}
          isLoading={isLoading}
        >
          <form
            id="withdrawal-form"
            onSubmit={(e) => {
              e.preventDefault();
              const recipientName = e.target['recipient-name'].value;
              const bankName = e.target['bank-name'].value;
              const cardNumber = e.target['card-number'].value;
              if (!recipientName || !bankName || !cardNumber) {
                showNotification('Пожалуйста, заполните все поля!');
                return;
              }
              if (!/^[0-9]{16}$/.test(cardNumber)) {
                showNotification('Неверный формат номера карты! Введите 16 цифр.');
                return;
              }
              setFinanceStats([...financeStats, {
                date: new Date().toLocaleDateString('ru-RU'),
                amount: '20,000 ₸',
                status: 'Ожидает'
              }]);
              updateWithdrawalButtons();
              showNotification(`Запрос на вывод (${recipientName}, ${bankName}, ${cardNumber}) отправлен! Статус будет обновлён в течение 24 часов.`);
              closeModal();
            }}
          >
            <label>
              Имя и Фамилия на карте получателя:
              <input type="text" id="recipient-name" required aria-label="Имя и Фамилия на карте получателя" />
            </label>
            <label>
              Наименование банка:
              <input type="text" id="bank-name" required aria-label="Наименование банка" />
            </label>
            <label>
              Номер карты:
              <input
                type="text"
                id="card-number"
                required
                pattern="[0-9]{16}"
                aria-label="Номер карты"
                placeholder="XXXX-XXXX-XXXX-XXXX"
              />
            </label>
            <button type="submit" className="action-button" style={{ marginTop: "15px" }}>
              <i className="fas fa-paper-plane" aria-hidden="true"></i> Отправить запрос
            </button>
          </form>
        </Modal>

        {/* Модалка "Мои промокоды" */}
        <Modal
          id="marketing-modal"
          title="Мои промокоды"
          isOpen={openModalId === "marketing-modal"}
          onClose={closeModal}
          isLoading={isLoading}
        >
          <p className="marketing-tip">Создавайте промокоды и отслеживайте их использование!</p>
          <div className="promo-section">
            <i className="fas fa-ticket-alt" aria-hidden="true"></i>
            <div>
              <h3>Создание промокодов</h3>
              <p id="promo-count">Создано {promoCodes.length}/3 промокодов</p>
              <div className="promo-create">
                <input
                  type="text"
                  id="new-promo"
                  placeholder="Введите промокод (6-15 символов)"
                  maxLength="15"
                  pattern="[a-zA-Z0-9]{6,15}"
                />
                <button type="button" className="action-button" onClick={createPromoCode}>Создать</button>
              </div>
              <table className="stats-table promo-table" aria-label="Статистика промокодов">
                <thead>
                  <tr>
                    <th scope="col">Промокод</th>
                    <th scope="col">Дата создания</th>
                    <th scope="col">Использования</th>
                    <th scope="col">Регистрации</th>
                    <th scope="col">Доход</th>
                    <th scope="col">Действия</th>
                  </tr>
                </thead>
                <tbody id="promo-list">
                  {promoCodes.map((promo, index) => (
                    <tr key={index} className={`promo-item ${promo.uses > 0 ? 'active' : ''}`}>
                      <td>
                        <span>{promo.code}</span>
                        <i
                          className="fas fa-copy copy-promo"
                          onClick={() => copyPromoCode(promo.code)}
                          title="Скопировать промокод"
                        ></i>
                      </td>
                      <td>{promo.created}</td>
                      <td>{promo.uses}</td>
                      <td>{promo.registrations}</td>
                      <td>{promo.revenue}</td>
                      <td><button onClick={() => deletePromoCode(index)}>Удалить</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Modal>

        {/* Модалка "История активности" */}
        <Modal
          id="activity-modal"
          title="История активности"
          isOpen={openModalId === "activity-modal"}
          onClose={closeModal}
          isLoading={isLoading}
        >
          <div className="filters activity-filters">
            <label>
              Период:
              <select
                id="activity-period-filter"
                value={activityPeriodFilter}
                onChange={(e) => setActivityPeriodFilter(e.target.value)}
              >
                <option value="7">Последние 7 дней</option>
                <option value="30">Последние 30 дней</option>
                <option value="all">Все время</option>
              </select>
            </label>
            <label>
              Действие:
              <select
                id="activity-action-filter"
                value={activityActionFilter}
                onChange={(e) => setActivityActionFilter(e.target.value)}
              >
                <option value="all">Все</option>
                <option value="registration">Регистрация</option>
                <option value="purchase">Покупка</option>
              </select>
            </label>
            <label>
              ID реферала:
              <input
                type="text"
                id="activity-id-filter"
                placeholder="Введите ID"
                value={activityIdFilter}
                onChange={(e) => setActivityIdFilter(e.target.value)}
                aria-label="Фильтр по ID реферала"
              />
            </label>
          </div>
          <table className="activity-table" aria-label="История активности рефералов">
            <thead>
              <tr>
                <th scope="col">ID <i className="fas fa-sort" aria-hidden="true"></i></th>
                <th scope="col">Действие <i className="fas fa-sort" aria-hidden="true"></i></th>
                <th scope="col">Дата <i className="fas fa-sort" aria-hidden="true"></i></th>
                <th scope="col">Источник <i className="fas fa-sort" aria-hidden="true"></i></th>
                <th scope="col">Доход <i className="fas fa-sort" aria-hidden="true"></i></th>
              </tr>
            </thead>
            <tbody>
              {filteredActivityData.map((r, index) => {
                const actionText = r.action === 'registration' ? 'Регистрация' : 'Покупка';
                const icon = r.action === 'registration' ? 'fa-user-plus' : 'fa-shopping-cart';
                const revenueClass = r.revenue === '0 ₸' ? 'revenue-zero' : 'revenue-positive';
                return (
                  <tr key={index} className={`activity-item ${r.action}`}>
                    <td>{r.id}</td>
                    <td><i className={`fas ${icon}`} aria-hidden="true"></i> {actionText}</td>
                    <td>{r.date}</td>
                    <td>{r.source}</td>
                    <td className={revenueClass}>{r.revenue}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Modal>

        {/* Модалка "Настройки" */}
        <Modal
          id="settings-modal"
          title="Настройки"
          isOpen={openModalId === "settings-modal"}
          onClose={closeModal}
          isLoading={isLoading}
        >
          <form id="settings-form" onSubmit={saveSettings}>
            <fieldset className="settings-fieldset">
              <legend>Личные данные</legend>
              <div className="settings-field">
                <i className="fas fa-user" aria-hidden="true"></i>
                <label>
                  Имя:
                  <input
                    type="text"
                    id="partner-name"
                    value={partnerName}
                    onChange={(e) => setPartnerName(e.target.value)}
                    required
                    aria-label="Имя пользователя"
                    placeholder="Введите ваше имя"
                  />
                </label>
              </div>
              <div className="settings-field">
                <i className="fas fa-envelope" aria-hidden="true"></i>
                <label>
                  Email:
                  <input
                    type="email"
                    id="partner-email"
                    value={partnerEmail}
                    onChange={(e) => setPartnerEmail(e.target.value)}
                    required
                    aria-label="Электронная почта"
                    placeholder="Введите ваш email"
                  />
                </label>
              </div>
            </fieldset>
            <fieldset className="settings-fieldset">
              <legend>Смена пароля</legend>
              <div className="settings-field">
                <i className="fas fa-lock" aria-hidden="true"></i>
                <label>
                  Текущий пароль:
                  <input
                    type="password"
                    id="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required={newPassword || confirmPassword}
                    aria-label="Текущий пароль"
                    placeholder="Введите текущий пароль"
                  />
                </label>
              </div>
              <div className="settings-field">
                <i className="fas fa-lock" aria-hidden="true"></i>
                <label>
                  Новый пароль:
                  <input
                    type="password"
                    id="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength="8"
                    aria-label="Новый пароль"
                    placeholder="Минимум 8 символов"
                  />
                </label>
              </div>
              <div className="settings-field">
                <i className="fas fa-lock" aria-hidden="true"></i>
                <label>
                  Подтверждение пароля:
                  <input
                    type="password"
                    id="confirm-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength="8"
                    aria-label="Подтверждение пароля"
                    placeholder="Повторите новый пароль"
                  />
                </label>
              </div>
            </fieldset>
            <div className="settings-actions">
              <button type="submit" className="action-button">
                <i className="fas fa-save" aria-hidden="true"></i> Сохранить
              </button>
              <span id="save-status" className="save-status" style={{ display: notificationMessage === 'Настройки сохранены!' ? 'inline-flex' : 'none' }}>
                <i className="fas fa-check" aria-hidden="true"></i> Сохранено
              </span>
            </div>
          </form>
        </Modal>

        {/* Модалка "Обучение и FAQ" */}
        <Modal
          id="training-modal"
          title="Обучение и FAQ"
          isOpen={openModalId === "training-modal"}
          onClose={closeModal}
          isLoading={isLoading}
        >
          <p><a href="#">Видео: Как начать</a></p>
          <p>Q: Как вывести деньги?<br />A: Нажмите "Запросить вывод" в разделе Финансы.</p>
          <button type="button" onClick={() => openModal('support-modal')}>
            <i className="fas fa-question-circle" aria-hidden="true"></i> Задать вопрос
          </button>
        </Modal>

        {/* Модалка "Уведомления" */}
        <Modal
          id="notifications-modal"
          title="Уведомления"
          isOpen={openModalId === "notifications-modal"}
          onClose={closeModal}
          isLoading={isLoading}
        >
          <ul id="notifications-list">
            <li>01.03.2025: Реферал 001 зарегистрировался</li>
            <li>02.03.2025: Реферал 001 совершил покупку на 50,000 ₸</li>
          </ul>
        </Modal>
      </main>
    </div>
  );
}