import type { EN } from './en';

export const RU = {
  account: 'Аккаунт',
  sync: 'Синхронизация',
  syncNow: 'Синхронизировать',
  back: 'Назад',
  continueGoogle: 'Продолжить с Google',
  lastSuccessfulSync: 'Последняя успешная синхронизация',
  lastRefresh: 'Последнее обновление библиотеки',
  syncSignIn: 'Войдите, чтобы синхронизировать библиотеку.',
  syncLinkFirst: 'Подключите библиотеку устройства к аккаунту в разделе «Библиотека».',
  onlineRefresh:
    'Библиотека сайта доступна онлайн. Кнопка синхронизации загружает последние сохранённые данные.',
  loadingLibrary: 'Загрузка библиотеки…',
  addTitle: 'Добавить запись',
  noPoster: 'Нет постера',
  unknownYear: 'Год неизвестен',
  unrated: 'Без оценки',
  searchLibrary: 'Поиск в библиотеке',
  genres: 'Жанры',
  sortBy: 'Сортировать',
  order: 'Порядок',
  ascending: 'А–Я',
  descending: 'Я–А',
  highestFirst: 'Сначала высокие',
  lowestFirst: 'Сначала низкие',
  newestFirst: 'Сначала новые',
  oldestFirst: 'Сначала старые',
  entryActions: 'Действия с записью',
  recentlyUpdated: 'Недавно изменённые',
  year: 'Год',
  listView: 'Список',
  gridView: 'Карточки',
  statusTabs: 'Статус просмотра',
  all: 'Все',
  noMatches: 'Нет записей с такими параметрами.',
  emptyLibrary: 'В библиотеке пока пусто. Добавьте первую запись.',
  of: 'из',
  pagination: 'Страницы библиотеки',
  previousPage: 'Предыдущая страница',
  nextPage: 'Следующая страница',
  signInLibrary: 'Войдите, чтобы открыть онлайн-библиотеку.',
  libraryLoadFailed: 'Не удалось загрузить библиотеку. Повторите попытку.',
  retry: 'Повторить',
  linkSummary:
    'Подключение: {{local}} на устройстве и {{remote}} в аккаунте. Совпадения: {{conflicts, number}}.',
  library: 'Библиотека',
  catalog: 'Поиск в каталоге',
  settings: 'Настройки',
  anime: 'Аниме',
  films: 'Фильмы',
  tv: 'Сериалы',
  page: 'Страница',
  search: 'Поиск',
  myLibrary: 'Моя библиотека',
  language: 'Язык',
  theme: 'Оформление',
  light: 'Светлое',
  dark: 'Тёмное',
  fullPage: 'Открыть полную страницу',
  navigation: 'Основная навигация',
  categories: 'Категории',
  unavailableCatalog:
    'Поиск в каталоге пока недоступен. Можно добавлять записи вручную в библиотеке.',
  unavailablePage:
    'Распознавание страницы пока недоступно. Откройте библиотеку, чтобы добавить запись вручную.',
  websiteLibrary:
    'Онлайн-библиотека пока недоступна. Библиотекой расширения можно пользоваться без интернета.',
  unsaved: 'Несохранённые изменения',
  unsavedDescription: 'Сохраните изменения перед переходом или отмените их.',
  save: 'Сохранить',
  discard: 'Не сохранять',
  continueEditing: 'Продолжить редактирование',
  preferencesFailed: 'Не удалось сохранить настройки. Повторите попытку.',
  'Server versions win conflicts; rejected local edits remain available for review. Confirming authorizes uploading device entries and downloading account entries.':
    'При конфликте сохраняется версия сервера; отклонённые изменения остаются для проверки. Подтверждение разрешает загрузку записей устройства и скачивание записей аккаунта.',
  'Extension credential storage is unavailable. Check identity/storage permissions and reload the extension.':
    'Хранилище учётных данных недоступно. Проверьте разрешения identity/storage и перезагрузите расширение.',
  'Cannot reach the API. Check that it is running and that the extension has permission for the API origin.':
    'Не удалось подключиться к API. Проверьте, что он запущен и расширению разрешён доступ.',
  'Add this extension origin to API EXTENSION_ORIGINS, then restart the API.':
    'Добавьте адрес расширения в EXTENSION_ORIGINS и перезапустите API.',
  'Google login is disabled in the API configuration.':
    'Вход через Google отключён в настройках API.',
  'The browser login window failed. Check the service worker console and the API login configuration.':
    'Не удалось открыть окно входа. Проверьте консоль фонового процесса и настройки входа API.',
  'Google sign-in was cancelled. Start sign-in again when ready.':
    'Вход через Google отменён. Повторите попытку, когда будете готовы.',
  'The login callback did not match this attempt. Reload the extension and start a new sign-in.':
    'Адрес возврата не соответствует этой попытке входа. Перезагрузите расширение и войдите заново.',
  'The API rejected this operation. Use the stage, HTTP status and request ID to inspect the API log.':
    'API отклонил операцию. Проверьте журнал по этапу, статусу HTTP и идентификатору запроса.',
  'The API login endpoint is unavailable. Restart the API with the current code.':
    'Вход через API недоступен. Перезапустите API с актуальным кодом.',
  'The session or login code expired or was rejected. Start a new sign-in.':
    'Сессия или код входа истекли или отклонены. Войдите заново.',
  'The extension worker did not reply. Inspect its service worker console, reload the extension and reopen this page.':
    'Фоновый процесс не ответил. Проверьте его консоль, перезагрузите расширение и откройте страницу заново.',
  Title: 'Название',
  Category: 'Категория',
  Status: 'Статус',
  'No status': 'Без статуса',
  Rating: 'Оценка',
  Progress: 'Прогресс',
  Comment: 'Заметки',
  'Viewing URLs (one per line)': 'Ссылки для просмотра (по одной в строке)',
  'Reload entry': 'Загрузить запись заново',
  'Save locally': 'Сохранить на устройстве',
  Cancel: 'Отмена',
  'Add manual entry': 'Добавить вручную',
  Edit: 'Изменить',
  Delete: 'Удалить',
  Deleted: 'Удалено',
  Undo: 'Восстановить',
  Untitled: 'Без названия',
  'Library on this device': 'Библиотека на этом устройстве',
  'Local library': 'Локальная библиотека',
  'Retry local storage': 'Повторить чтение',
  'Export recoverable raw data': 'Экспортировать данные для восстановления',
  'Loading local data…': 'Загрузка данных…',
  'Saved locally · revision': 'Сохранено на устройстве · версия',
  'Saved on this device.': 'Сохранено на этом устройстве.',
  'This entry changed or its sources are already in use. Reload the entry before saving again.':
    'Запись изменилась или её ссылки уже используются. Загрузите запись заново перед сохранением.',
  'This entry is no longer available. Reload the library.':
    'Запись больше недоступна. Обновите библиотеку.',
  'A manual title and unique HTTP(S) sources are required.':
    'Укажите название и уникальные ссылки HTTP(S).',
  'The 10-second Undo period has expired.': 'Истекли 10 секунд для отмены удаления.',
  'Local storage is unavailable. Your existing data has been preserved.':
    'Локальное хранилище недоступно. Ваши данные сохранены.',
  'Save failed. Your input is still here; retry or reload the entry.':
    'Не удалось сохранить. Введённые данные сохранены в форме; повторите попытку или загрузите запись заново.',
  'The current entry could not be loaded. Your input is still here.':
    'Не удалось загрузить запись. Введённые данные остались в форме.',
  'Local save failed. Existing data has been preserved.':
    'Не удалось сохранить. Существующие данные сохранены.',
  'Raw data could not be read. Storage has not been changed.':
    'Не удалось прочитать данные. Хранилище не изменено.',
  'Local data could not be read. Existing storage has been preserved.':
    'Не удалось прочитать локальные данные. Хранилище сохранено.',
  '· Progress': '· Прогресс',
  'One of the libraries changed. Preview the link again before confirming.':
    'Одна из библиотек изменилась. Проверьте подключение заново перед подтверждением.',
  'Synchronization is paused. Sign in to the account linked to this device library.':
    'Синхронизация приостановлена. Войдите в аккаунт, подключённый к этой библиотеке.',
  'The server rejected a document. Your local data is preserved; retry after correcting it.':
    'Сервер отклонил запись. Данные сохранены; исправьте запись и повторите попытку.',
  'The API could not be reached. Check its address and connection; saved changes will be retried.':
    'API недоступен. Проверьте адрес и соединение; сохранённые изменения будут отправлены повторно.',
  'The extension worker did not reply. Reload the extension and reopen this page.':
    'Фоновый процесс расширения не ответил. Перезагрузите расширение и откройте страницу заново.',
  'The API denied synchronization. Check this extension origin in EXTENSION_ORIGINS and restart the API.':
    'API запретил синхронизацию. Проверьте адрес расширения в EXTENSION_ORIGINS и перезапустите API.',
  'The API has no replication route. Restart the API with the current implementation.':
    'API не поддерживает репликацию. Перезапустите API с актуальным кодом.',
  'The API returned an unreadable response. Check the API address and server logs.':
    'API вернул нечитаемый ответ. Проверьте адрес API и журнал сервера.',
  'The synchronization batch exceeds the API body limit. Your saved changes are preserved.':
    'Пакет синхронизации превышает лимит API. Изменения сохранены.',
  'The API is rate limiting synchronization. Saved changes will be retried.':
    'API ограничил частоту запросов. Сохранённые изменения будут отправлены повторно.',
  'The API failed to synchronize. Use the request ID below to check its logs.':
    'Ошибка синхронизации API. Найдите запрос в журнале по идентификатору ниже.',
  'The API is unavailable. Check database readiness; saved changes will be retried.':
    'API недоступен. Проверьте готовность базы; изменения будут отправлены повторно.',
  'Local replication failed. Saved data is preserved; check the diagnostic code below.':
    'Ошибка локальной репликации. Данные сохранены; проверьте код диагностики ниже.',
  'Synchronization failed. Saved local changes will be retried.':
    'Ошибка синхронизации. Сохранённые изменения будут отправлены повторно.',
  'Account synchronization is up to date.': 'Библиотека аккаунта синхронизирована.',
  'Synchronizing saved changes, or waiting for another open window…':
    'Синхронизация изменений или ожидание другого окна…',
  'Saved on this device. Link explicitly to synchronize with your account.':
    'Сохранено на устройстве. Подключите библиотеку для синхронизации с аккаунтом.',
  'Synchronization paused: sign in to the account linked to this device library.':
    'Синхронизация приостановлена: войдите в подключённый аккаунт.',
  'Synchronization paused: history reset requires recovery.':
    'Синхронизация приостановлена: после сброса истории требуется восстановление.',
  'Synchronization storage could not be read. Existing data is preserved.':
    'Не удалось прочитать данные синхронизации. Существующие данные сохранены.',
  'The operation failed. Your local data is preserved.':
    'Операция не выполнена. Локальные данные сохранены.',
  'The operation failed or the entry changed. Reload and review before trying again.':
    'Операция не выполнена или запись изменилась. Обновите и проверьте данные перед повторной попыткой.',
  'Account synchronization': 'Синхронизация аккаунта',
  'Code:': 'Код:',
  'Preview account link': 'Проверить подключение аккаунта',
  Link: 'Подключить',
  'active device entries with': 'активных записей устройства к',
  'account entries.': 'записям аккаунта.',
  'device entries have overlapping identities or sources. Server versions win conflicts; rejected local edits remain available for review. Confirming authorizes uploading device entries and downloading account entries.':
    'записей устройства имеют совпадающие идентификаторы или ссылки. При конфликте сохраняется версия сервера; локальные изменения остаются для проверки. Подтверждение разрешает загрузку записей устройства и скачивание записей аккаунта.',
  'Confirm link and synchronize': 'Подтвердить и синхронизировать',
  'Cancel link': 'Отменить подключение',
  'Refresh account library': 'Обновить библиотеку аккаунта',
  'Recovery saves all current device entries for review, then loads the current account library. Entries absent from the server remain deleted until you deliberately reapply them.':
    'Восстановление сохраняет записи устройства для проверки и загружает библиотеку аккаунта. Отсутствующие на сервере записи останутся удалёнными, пока вы явно не восстановите их.',
  'Preserve local intent and recover': 'Сохранить изменения и восстановить',
  'saved edits need review.': 'сохранённых изменений требуют проверки.',
  'Saved before history reset': 'Сохранено перед сбросом истории',
  'Rejected local edit': 'Отклонённое локальное изменение',
  'Reapply this saved edit': 'Применить сохранённое изменение',
  'Dismiss saved edit': 'Удалить сохранённое изменение',
  'Signed in': 'Вход выполнен',
  'Sign out': 'Выйти',
  'Sign out all sessions': 'Выйти на всех устройствах',
  'Sign in with Google': 'Войти через Google',
  'Stage:': 'Этап:',
  'Connection details': 'Параметры подключения',
  'Extension ID': 'ID расширения',
  API: 'API',
  'Allowed origin needed': 'Требуемый разрешённый адрес',
  'Extension callback': 'Адрес возврата расширения',
  'Account service unavailable. Please retry.': 'Сервис аккаунтов недоступен. Повторите попытку.',
  'The extension worker did not reply. Reload the extension and inspect its service worker console.':
    'Фоновый процесс не ответил. Перезагрузите расширение и проверьте консоль фонового процесса.',
  Operation: 'Операция',
  Request: 'Запрос',
  process: 'Смотрю',
  complete: 'Просмотрено',
  drop: 'Брошено',
  hide: 'Скрыто',
  watching: 'Смотрю',
  planned: 'Запланировано',
  watched: 'Просмотрено',
  hidden: 'Скрыто',
  titleCount_one: '{{count, number}} запись',
  titleCount_few: '{{count, number}} записи',
  titleCount_other: '{{count, number}} записей',
  titleCount_many: '{{count, number}} записей',
  reviewCount_one: '{{count, number}} сохранённое изменение требует проверки.',
  reviewCount_few: '{{count, number}} сохранённых изменения требуют проверки.',
  reviewCount_other: '{{count, number}} сохранённых изменений требуют проверки.',
  reviewCount_many: '{{count, number}} сохранённых изменений требуют проверки.',
} satisfies Record<keyof typeof EN, string>;
