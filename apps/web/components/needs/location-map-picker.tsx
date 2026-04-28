'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  APIProvider,
  Map,
  AdvancedMarker,
  MapMouseEvent,
} from '@vis.gl/react-google-maps'
import { MapPin, AlertCircle } from 'lucide-react'

interface LatLng {
  lat: number
  lng: number
}

interface LocationMapPickerProps {
  /** Current pin position. Pass null to show India-centred view with no pin. */
  value: LatLng | null
  /** Called whenever the pin is moved (drag end or map click). */
  onChange: (coords: LatLng) => void
  /** When true the pin cannot be moved. */
  readonly?: boolean
  className?: string
}

// India centre — shown when no coordinates are available yet
const INDIA_CENTER: LatLng = { lat: 22.5, lng: 78.96 }
const INDIA_ZOOM = 5
const PIN_ZOOM = 13

export function LocationMapPicker({
  value,
  onChange,
  readonly = false,
  className = '',
}: LocationMapPickerProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY

  const [center, setCenter] = useState<LatLng>(value ?? INDIA_CENTER)
  const [zoom, setZoom] = useState(value ? PIN_ZOOM : INDIA_ZOOM)

  // When a new value arrives from outside (e.g. after geocoding), re-centre
  useEffect(() => {
    if (value) {
      setCenter(value)
      setZoom(PIN_ZOOM)
    }
  }, [value?.lat, value?.lng])

  const handleDragEnd = useCallback(
    (e: any) => {
      if (readonly || !e.latLng) return
      onChange({ lat: e.latLng.lat(), lng: e.latLng.lng() })
    },
    [readonly, onChange],
  )

  const handleMapClick = useCallback(
    (e: MapMouseEvent) => {
      if (readonly || !e.detail.latLng) return
      const { lat, lng } = e.detail.latLng
      onChange({ lat, lng })
      setCenter({ lat, lng })
    },
    [readonly, onChange],
  )

  if (!apiKey) {
    return (
      <div className={`flex items-center gap-2 rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800 ${className}`}>
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span>Google Maps key not set. Add <code>NEXT_PUBLIC_GOOGLE_MAPS_KEY</code> to <code>.env.local</code>.</span>
      </div>
    )
  }

  return (
    <div className={`overflow-hidden rounded-lg border border-zinc-200 ${className}`}>
      <APIProvider apiKey={apiKey}>
        <Map
          style={{ width: '100%', height: '100%' }}
          center={center}
          zoom={zoom}
          onCameraChanged={(e) => {
            setCenter(e.detail.center)
            setZoom(e.detail.zoom)
          }}
          onClick={handleMapClick}
          disableDefaultUI={false}
          mapId="nectaid-location-picker"
          gestureHandling="cooperative"
        >
          {value && (
            <AdvancedMarker
              position={value}
              draggable={!readonly}
              onDragEnd={handleDragEnd}
              title={readonly ? 'Need location' : 'Drag to adjust location'}
            />
          )}
        </Map>
      </APIProvider>

      {!readonly && (
        <p className="border-t border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-500">
          {value
            ? `${value.lat.toFixed(5)}, ${value.lng.toFixed(5)} — drag pin or click map to adjust`
            : 'Click anywhere on the map to place a pin'}
        </p>
      )}
    </div>
  )
}