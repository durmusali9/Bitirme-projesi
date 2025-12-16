# Çevrimiçi Dil Öğrenenler Özelliği - Test Kılavuzu

## Yapılan Değişiklikler

### 1. Backend (server.js)
- Socket.io connection handler'ında aktif kullanıcıları broadcast etme eklendi
- `broadcastActiveUsers()` fonksiyonu:
  - Tüm bağlı socket'lerin user bilgisini toplar
  - `active_users` event'ini tüm clientlere gönderir
  - Yeni bağlantı ve disconnect sırasında tetiklenir

### 2. Frontend (index.html)

#### HTML Değişiklik
- "activeUsersList" ID'li boş div oluşturdu
- Dinamik olarak kullanıcı kartları buraya eklenir

#### JavaScript Fonksiyonları

**1. `updateActiveUsersList(users)`**
- Gelen kullanıcı dizisini HTML card'lara dönüştürür
- Avatar rengi kullanıcı ID'sine dayalı hesaplanır
- "Çevrimiçi" durumunu gösterir

**2. `getAvatarColor(userId)`**
- Kullanıcı ID'sine dayalı tutarlı renk seçer
- 8 farklı renk kullanır
- Aynı kullanıcı her zaman aynı rengi alır

**3. Socket Event Listeners**
- `active_users` event'i dinlenir
- Güncellenmiş kullanıcı listesi alınır
- `updateActiveUsersList()` çağrılır
- `disconnect` sırasında liste temizlenir

## Test Adımları

### Manuel Test (Tarayıcı)

1. **Tarayıcı 1 - Kullanıcı 1:**
   - http://localhost:4000 aç
   - Kayıt Ol butonuna tıkla
   - Form doldur ve kayıt ol
   - Giriş yap
   - "Çevrimiçi Dil Öğrenenler" bölümünü kontrol et
   - Kendi ismi görülmeli

2. **Tarayıcı 2 - Kullanıcı 2:** (aynı adımları tekrarla)
   - Kayıt ol (farklı e-posta)
   - Giriş yap
   - "Çevrimiçi Dil Öğrenenler" bölümünde 2 kullanıcı görülmeli
   - Her iki tarayıcıda da listenin 2 kişi olması gerekir

3. **Tarayıcı 3 - Kullanıcı 3:** (aynı adımları tekrarla)
   - Kayıt ol
   - Giriş yap
   - Tüm tarayıcılarda 3 kişi görülmeli

4. **Disconnect Test:**
   - Tarayıcı 1'i kapat
   - Diğer tarayıcılarda otomatik olarak 2 kişiye düşmeli
   - Yenile et (refresh) - hala 2 kişi olmalı

### Otomatik Test (test_active_users.js)

```bash
node test_active_users.js
```

Test şunları yapar:
- 3 test kullanıcısı oluşturur
- Tüm kullanıcılar socket.io ile bağlanır
- `active_users` event'ini dinler
- Bağlı kullanıcı listesini konsola yazdırır
- Socket'leri disconnect eder

## Expected Output (Console)

**Server Console:**
```
Bir kullanıcı bağlandı: <socket-id> user: <user-id>
Bir kullanıcı bağlandı: <socket-id> user: <user-id>
Bir kullanıcı bağlandı: <socket-id> user: <user-id>
```

**Browser Console:**
```
Active users update: {users: Array(3), count: 3}
```

**Web Page:**
- 3 adet user-card görülmeli
- Her biri avatar (renkli kare), isim ve "Çevrimiçi" etiketi
- Avatar renkleri farklı

## Troubleshooting

### Kullanıcılar görünmüyor
- Browser console'da (F12) error olup olmadığını kontrol et
- Server console'unda "Bir kullanıcı bağlandı" mesajı gelmeli
- Socket.io bağlantısı check et: console'da "Socket connected" logla

### Renk tutarsızlığı
- `getAvatarColor()` fonksiyonu ID hash'ini kullanır
- Aynı kullanıcı yenile (refresh) ettikten sonra aynı rengi almak zorunda

### Real-time güncelleme yok
- Server disconnect event'i tetiklenmiyor mu
- `broadcastActiveUsers()` her disconnect'te çağrılmalı

## Teknik Detaylar

### Data Flow

1. **Bağlantı Kurulması:**
   - Socket bağlanır → auth token gönderilir
   - Server validateToken ile user bilgisini alır
   - `broadcastActiveUsers()` çağrılır
   - Tüm clientler `active_users` event'ini alır

2. **Disconnect:**
   - Socket disconnect olur
   - `broadcastActiveUsers()` çağrılır
   - Tüm clientler güncellenmiş listeyi alır

### Object Yapısı

```javascript
// Server'dan gelen active_users payload
{
    users: [
        {
            id: ObjectId,
            name: string,
            email: string,
            socketId: string
        },
        ...
    ],
    count: number
}
```

### Client Rendering

```html
<div class="user-card">
    <div class="user-avatar" style="background-color: #4361ee;">A</div>
    <div class="user-info">
        <div class="user-name">Ahmet Yılmaz</div>
        <div class="user-languages">🟢 Çevrimiçi</div>
    </div>
</div>
```
