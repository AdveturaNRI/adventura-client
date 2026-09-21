export const QUESTIONNAIRE_STEPS = [
    'roles',
    'profile',
    'experience',
    'location',
    'systems',
    'final',
];
export const QUESTIONNAIRE_STEP_INDEX = {
    roles: 0,
    profile: 1,
    experience: 2,
    location: 3,
    systems: 4,
    final: 5,
};
export const QUESTIONNAIRE_TOTAL_STEPS = 6;
export const QUESTIONNAIRE_STEP_TITLES = [
    'Роль',
    'Профиль',
    'Время',
    'Локация',
    'Системы',
    'Финал',
];
export const QUESTIONNAIRE_ENTRY = '/questionnaire';
export const QUESTIONNAIRE_CONTINUE_LABEL = 'Сохранить и продолжить';
export const QUESTIONNAIRE_FINISH_LABEL = 'Готово';
export const QUESTIONNAIRE_EDIT_LABEL = 'Редактировать';
export const QUESTIONNAIRE_SAVE_EXIT_LABEL = 'Сохранить и выйти';
export const QUESTIONNAIRE_SAVING_LABEL = 'Сохраняем...';
export const QUESTIONNAIRE_SAVED_TOAST = 'Прогресс анкеты сохранён';
export const QUESTIONNAIRE_FINISHED_TOAST = 'Анкета сохранена';
/** Куда уходим после «Готово» на финале */
export const QUESTIONNAIRE_AFTER_FINISH_HREF = '/wanderers';
export const QUESTIONNAIRE_UNSAVED_TITLE = 'Есть несохранённые изменения';
export const QUESTIONNAIRE_UNSAVED_MESSAGE = 'Сохранить изменения на этом шаге перед выходом из анкеты?';
export const QUESTIONNAIRE_UNSAVED_SAVE_LABEL = 'Сохранить';
export const QUESTIONNAIRE_UNSAVED_DISCARD_LABEL = 'Выйти без сохранения';
export const QUESTIONNAIRE_UNSAVED_CANCEL_LABEL = 'Остаться';
export const QUESTIONNAIRE_DELETE_LABEL = 'Удалить анкету';
export const QUESTIONNAIRE_DELETE_TITLE = 'Удалить анкету?';
export const QUESTIONNAIRE_DELETE_MESSAGE = 'Все данные анкеты будут удалены: фото, статус, описание, опыт, локацию и системы. Никнейм аккаунта сохранится.';
export const QUESTIONNAIRE_DELETE_CONFIRM_LABEL = 'Удалить';
export const QUESTIONNAIRE_DELETE_CANCEL_LABEL = 'Отмена';
export const QUESTIONNAIRE_DELETED_TOAST = 'Анкета удалена';
export const ROLES_STEP = {
    key: 'roles',
    title: 'Кем вы хотите быть?',
    subtitle: 'Выберите роль, которая лучше всего описывает вас сейчас',
    hint: 'Роль можно изменить в любой момент в анкете. Если вы только знакомитесь с настольными ролевыми играми — смело выбирайте «Игрок»: мастером можно стать позже, когда появится желание вести свои истории.',
    options: [
        {
            key: 'player',
            label: 'Игрок',
            description: 'Ищу игры и хочу присоединиться к приключениям',
            icon: 'person-outline',
        },
        {
            key: 'master',
            label: 'Мастер',
            description: 'Хочу создавать и вести игры для других',
            icon: 'book-outline',
        },
        {
            key: 'both',
            label: 'И игрок, и мастер',
            description: 'Играю в одних кампаниях и веду другие',
            icon: 'people-outline',
        },
    ],
};
export const PROFILE_STEP = {
    key: 'profile',
    title: 'Расскажите о себе',
    subtitle: 'Добавьте фото для карточки, никнейм и статус',
    hint: 'Никнейм виден всем в приложении. Статус — короткая фраза о вас. Фото анкеты — ваша карточка в ленте Странники, где игроки знакомятся и собирают компанию для игр.',
    profileCardLabel: 'Фото анкеты',
    profileCardDescription: 'Большое фото для ленты Странники — покажите себя так, как вам нравится. Необязательное поле.',
    addPhotoLabel: 'Добавить фото',
    nicknameLabel: 'Никнейм',
    statusLabel: 'Статус',
    statusPlaceholder: 'Например: ищу кампанию по D&D',
    descriptionLabel: 'Описание',
    descriptionPlaceholder: 'Расскажите о себе, своём опыте и что ищете в играх',
    descriptionLabelHint: 'Необязательное поле, до 2000 символов',
    descriptionMaxLength: 2000,
    ageLabel: 'Возраст',
    ageLabelHint: 'Обязательное поле',
    visibilityTitle: 'Видимость анкеты',
    visibilitySubtitle: 'Кто может увидеть вашу анкету в приложении',
    visibilityPublicLabel: 'Публичная',
    visibilityPrivateLabel: 'Приватная',
    visibilityPublicDescription: 'Анкета видна в ленте Странники, если заполнены обязательные поля',
    visibilityPrivateDescription: 'Скрыта из ленты, даже если анкета заполнена',
    visibilityPublicHint: 'Публичная анкета попадает в ленту Странники только после заполнения обязательных полей: роль, статус, возраст, опыт, расписание, часовой пояс, локация и системы.',
    visibilityPrivateHint: 'Приватная анкета не показывается в ленте. Её увидят только те, кому вы откроете доступ после заявки на игру.',
};
export const EXPERIENCE_STEP = {
    key: 'experience',
    title: 'Опыт и когда удобно играть',
    subtitle: 'Укажите опыт, часовой пояс и свободные дни',
    hint: 'Эти данные помогают мастерам и игрокам быстрее понять, подходите ли вы друг другу.',
    experiencePanelTitle: 'Сколько уже играете',
    experiencePanelSubtitle: 'Выберите уровень, который лучше всего вас описывает',
    experienceLabel: 'Опыт игры',
    experiencePlaceholder: 'Выберите опыт',
    availabilityPanelTitle: 'Когда удобно играть',
    availabilityPanelSubtitle: 'Отметьте дни и при желании укажите время для каждого — или выберите «по договорённости»',
    timezoneLabel: 'Часовой пояс',
    timezoneLabelHint: 'Обязательное поле',
    timezonePlaceholder: 'Выберите часовой пояс',
    timezoneHint: 'Пояса России и Беларуси. Время в расписании считается в выбранном поясе; по умолчанию — московское.',
    availabilityDaysLabel: 'Дни недели',
    availabilityDaysHint: 'Выберите дни, затем задайте время для каждого. Соседние дни с одинаковым временем соберутся в диапазон',
    availabilityTimeLabel: 'Время по дням',
    availabilityFromLabel: 'с',
    availabilityToLabel: 'до',
    availabilityTimePlaceholder: '20:00',
    availabilityApplyToAllLabel: 'Применить ко всем',
    availabilityAgreementLabel: 'По договорённости',
    availabilityAgreementHint: 'Время и дни обсудим отдельно в чате',
};
export const LOCATION_STEP = {
    key: 'location',
    title: 'Где вы играете',
    subtitle: 'Укажите один или несколько городов — или отметьте, что играете онлайн',
    hint: 'Можно выбрать до 3 городов, если живёте на два региона или готовы ездить на сессии. Локация помогает находить офлайн-игры рядом.',
    cityLabel: 'Города',
    cityPlaceholder: 'Начните вводить название',
    cityEmptyHint: 'Пока не выбраны',
    cityLimitHint: 'Можно выбрать до 3 городов',
    addCityLabel: 'Добавить',
    playsOnlineLabel: 'Играю онлайн',
    playsOnlineRequiredHint: 'Обязательно, если город не указан',
    changeCityLabel: 'Изменить',
};
export const SYSTEMS_STEP = {
    key: 'systems',
    title: 'Игровые системы',
    subtitle: 'Отметьте системы, в которых вы уже играли',
    hint: 'Выберите системы из списка или добавьте свою. Если конкретных предпочтений нет — отметьте «Любая система». Можно также указать готовность изучить новое.',
    panelTitle: 'Ваши системы',
    panelSubtitle: 'Можно выбрать несколько или добавить свою',
    emptyHint: 'Пока ничего не выбрано',
    addLabel: 'Добавить',
    changeLabel: 'Изменить',
    pickerTitle: 'Выберите системы',
    pickerDoneLabel: 'Готово',
    pickerCatalogTitle: 'Из списка',
    pickerOfficialTitle: 'Официальные',
    pickerOtherTitle: 'Другие',
    pickerUserTitle: 'Пользовательские',
    pickerCustomTitle: 'Добавить свою',
    pickerCustomOpenLabel: 'Добавить свою систему',
    pickerCustomPlaceholder: 'Например: Savage Worlds',
    pickerCustomAddLabel: 'Добавить',
    pickerUserEmpty: 'Пока нет своих систем',
    pickerUserLockedHint: 'Нельзя изменить: есть игры по этой системе',
    pickerEditLabel: 'Изменить',
    pickerSaveLabel: 'Сохранить',
    pickerCancelLabel: 'Отмена',
    pickerDeleteLabel: 'Удалить',
    pickerSearchPlaceholder: 'Поиск по системе',
    pickerSearchEmpty: 'Ничего не найдено',
    openToAnySystemLabel: 'Любая система',
    openToAnySystemHint: 'Без предпочтений — подойдут любые системы',
    readyToLearnNewLabel: 'Готов изучить новое',
    readyToLearnNewHint: 'Открыт к новым системам, даже если пока не играл',
};
export const FINAL_STEP = {
    key: 'final',
    title: 'Ваша карточка готова',
    subtitle: 'Так вас увидят другие игроки в ленте Странники',
    hint: 'Проверьте карточку и статус видимости. Анкета попадает в ленту только если заполнены обязательные поля и включён режим «Публичная».',
    previewCaption: 'Превью карточки в ленте',
};
