import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Bell, ChevronRight, LogOut, Plane, Save, Sprout } from 'lucide-react';
import { AbsencesSection } from '../settings/AbsencesSection';
import { CareProfilesSection } from '../settings/CareProfilesSection';
import { NotificationsSection } from '../settings/NotificationsSection';
import { UserAvatar } from '../../components/avatar/UserAvatar';
import { Button } from '../../components/ui/Button';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { Text } from '../../components/ui/Text';
import { TextField } from '../../components/ui/TextField';
import { apiGetAuthed, apiPatchAuthed } from '../../lib/api';
import type { MeResponse, MeUpdateRequest } from '../../types/workspace';
import './screen.css';

type SettingsScreenProps = {
  onLogout: () => void;
};

type SettingsSection = 'home' | 'care-profiles' | 'absences' | 'notifications';

export function SettingsScreen({ onLogout }: SettingsScreenProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>('home');
  const [me, setMe] = useState<MeResponse | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSavedMessage, setProfileSavedMessage] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setProfileError(null);
    setIsProfileLoading(true);

    try {
      const data = await apiGetAuthed<MeResponse>('/api/me');
      setMe(data);
      setDisplayName(data.display_name ?? '');
    } catch (loadError) {
      setProfileError(
        loadError instanceof Error ? loadError.message : 'Profil se nenačetl.',
      );
    } finally {
      setIsProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedDisplayName = displayName.trim();
    if (!trimmedDisplayName || trimmedDisplayName === me?.display_name) {
      return;
    }

    setProfileError(null);
    setProfileSavedMessage(null);
    setIsProfileSaving(true);

    try {
      const payload: MeUpdateRequest = { display_name: trimmedDisplayName };
      const data = await apiPatchAuthed<MeResponse>('/api/me', payload);
      setMe(data);
      setDisplayName(data.display_name ?? '');
      setProfileSavedMessage('Uloženo.');
    } catch (saveError) {
      setProfileError(
        saveError instanceof Error ? saveError.message : 'Jméno se nepodařilo uložit.',
      );
    } finally {
      setIsProfileSaving(false);
    }
  }

  if (activeSection === 'care-profiles') {
    return <CareProfilesSection onBack={() => setActiveSection('home')} />;
  }

  if (activeSection === 'absences') {
    return <AbsencesSection onBack={() => setActiveSection('home')} />;
  }

  if (activeSection === 'notifications') {
    return <NotificationsSection onBack={() => setActiveSection('home')} />;
  }

  return (
    <section className="screen screen--stack settings-screen" aria-label="Nastavení">
      <ScreenHeader title="Nastavení" subtitle="Profil, péče, absence a notifikace" />

      <article className="settings-card settings-profile">
        <div className="settings-profile__identity">
          <UserAvatar
            label={profileDisplayName(me)}
            seed={me?.user_id ?? me?.email ?? 'user'}
            size="md"
          />
          <div className="settings-profile__identity-text">
            <Text variant="title">{profileDisplayName(me)}</Text>
            <Text as="p" variant="body" tone="muted">
              {me?.email ?? 'E-mail není dostupný'}
            </Text>
            <Text as="small" variant="caption">
              {me ? me.user_id : 'Načítám účet...'}
            </Text>
          </div>
        </div>

        <form className="settings-profile__form" onSubmit={handleProfileSubmit}>
          <TextField
            disabled={isProfileLoading || isProfileSaving}
            label="Zobrazované jméno"
            maxLength={120}
            name="display_name"
            onChange={(event) => {
              setDisplayName(event.target.value);
              setProfileSavedMessage(null);
            }}
            required
            value={displayName}
          />
          <Button
            disabled={
              isProfileLoading ||
              isProfileSaving ||
              !displayName.trim() ||
              displayName.trim() === me?.display_name
            }
            icon={<Save aria-hidden="true" size={18} />}
            type="submit"
          >
            {isProfileSaving ? 'Ukládám...' : 'Uložit'}
          </Button>
        </form>

        {profileError ? (
          <Text as="p" variant="body" tone="danger" className="text-banner">
            {profileError}
          </Text>
        ) : null}
        {profileSavedMessage ? (
          <Text as="p" variant="body" tone="muted" className="settings-profile__saved">
            {profileSavedMessage}
          </Text>
        ) : null}
      </article>

      <div className="settings-menu">
        <button
          className="settings-card settings-menu__item"
          onClick={() => setActiveSection('care-profiles')}
          type="button"
        >
          <span className="settings-menu__item-icon">
            <Sprout aria-hidden="true" size={18} />
          </span>
          <span className="settings-menu__item-text">
            <Text as="span" variant="label">
              Care profily
            </Text>
            <Text as="span" variant="caption" tone="muted">
              Rytmus zalévání, hnojení a přežití jednotlivých druhů.
            </Text>
          </span>
          <ChevronRight aria-hidden="true" className="settings-menu__chevron" size={18} />
        </button>
        <button
          className="settings-card settings-menu__item"
          onClick={() => setActiveSection('absences')}
          type="button"
        >
          <span className="settings-menu__item-icon">
            <Plane aria-hidden="true" size={18} />
          </span>
          <span className="settings-menu__item-text">
            <Text as="span" variant="label">
              Absence
            </Text>
            <Text as="span" variant="caption" tone="muted">
              Dny, kdy domácí džungle zůstává bez dozoru.
            </Text>
          </span>
          <ChevronRight aria-hidden="true" className="settings-menu__chevron" size={18} />
        </button>
        <button
          className="settings-card settings-menu__item"
          onClick={() => setActiveSection('notifications')}
          type="button"
        >
          <span className="settings-menu__item-icon">
            <Bell aria-hidden="true" size={18} />
          </span>
          <span className="settings-menu__item-text">
            <Text as="span" variant="label">
              Notifikace
            </Text>
            <Text as="span" variant="caption" tone="muted">
              Kdy tě má seržant vytrhnout z falešného klidu.
            </Text>
          </span>
          <ChevronRight aria-hidden="true" className="settings-menu__chevron" size={18} />
        </button>
      </div>

      <div className="settings-logout">
        <Button
          icon={<LogOut aria-hidden="true" size={18} />}
          onClick={onLogout}
        >
          Odhlásit
        </Button>
      </div>
    </section>
  );
}

function profileDisplayName(me: MeResponse | null): string {
  return me?.display_name ?? me?.email ?? 'Můj účet';
}
