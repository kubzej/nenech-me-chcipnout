import sergeantPhoto from '../../assets/brand/plant-drill-sergeant-cutout.png';
import { Button } from '../../components/ui/Button';
import { Text } from '../../components/ui/Text';
import './sergeant-intro-modal.css';

type SergeantIntroModalProps = {
  onDismiss: () => void;
};

export function SergeantIntroModal({ onDismiss }: SergeantIntroModalProps) {
  return (
    <div className="sergeant-intro" role="presentation">
      <div className="sergeant-intro__backdrop" />
      <div aria-modal="true" className="sergeant-intro__panel" role="dialog">
        <img
          alt="Naštvaný seržant Bodlák v květináči"
          className="sergeant-intro__face"
          src={sergeantPhoto}
        />
        <Text as="p" variant="kicker" className="sergeant-intro__eyebrow">
          Představení
        </Text>
        <Text as="h1" variant="heading" className="sergeant-intro__title">
          Čau, jsem seržant Bodlák.
        </Text>
        <Text as="p" variant="body" className="sergeant-intro__body">
          Beru vaše kytky pod dohled, protože samy to evidentně nezvládnou — a
          upřímně, vy taky ne. Denně ti řeknu, co zalít, co přihnojit a kdy něco
          umírá rychleji, než bys čekal. Nic osobního.
        </Text>
        <Text as="p" variant="body" className="sergeant-intro__body">
          No dobře, trochu osobní to je.
        </Text>
        <Button onClick={onDismiss}>Rozumím, seržante</Button>
      </div>
    </div>
  );
}
