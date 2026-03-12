/**
 * Browser Console Test - Çevrimiçi Kullanıcılar Simülasyonu
 * Tarayıcıda F12 açıp console'a yapıştır
 */

// Test Fonksiyonu
function testActiveUsers() {
    console.log('🧪 Testing Active Users Feature...\n');

    // 1. updateActiveUsersList fonksiyonunun var olup olmadığını kontrol et
    if (typeof updateActiveUsersList !== 'function') {
        console.error('❌ updateActiveUsersList fonksiyonu tanınmadı!');
        return;
    }
    console.log('✅ updateActiveUsersList fonksiyonu bulundu');

    // 2. getAvatarColor fonksiyonunun var olup olmadığını kontrol et
    if (typeof getAvatarColor !== 'function') {
        console.error('❌ getAvatarColor fonksiyonu tanınmadı!');
        return;
    }
    console.log('✅ getAvatarColor fonksiyonu bulundu');

    // 3. activeUsersList element'ini kontrol et
    const listEl = document.getElementById('activeUsersList');
    if (!listEl) {
        console.error('❌ activeUsersList element bulunamadı!');
        return;
    }
    console.log('✅ activeUsersList element bulundu\n');

    // 4. Test verisiyle updateActiveUsersList'i çağır
    const testUsers = [
        { id: '507f1f77bcf86cd799439011', name: 'Ahmet Yılmaz', email: 'ahmet@example.com' },
        { id: '507f1f77bcf86cd799439012', name: 'Zeynep Kaya', email: 'zeynep@example.com' },
        { id: '507f1f77bcf86cd799439013', name: 'Mehmet Demir', email: 'mehmet@example.com' }
    ];

    console.log('📝 Test Verileri:');
    testUsers.forEach((u, i) => {
        console.log(`  ${i+1}. ${u.name} (${u.email})`);
    });

    console.log('\n🎨 Avatar Renkleri:');
    testUsers.forEach(u => {
        const color = getAvatarColor(u.id);
        console.log(`  ${u.name}: ${color}`);
    });

    console.log('\n📋 Listeyi Render Etme...\n');
    updateActiveUsersList(testUsers);

    // 5. HTML'de doğru card'ların oluşup oluşmadığını kontrol et
    const cards = listEl.querySelectorAll('.user-card');
    console.log(`✅ ${cards.length} user-card oluşturuldu (Beklenen: ${testUsers.length})`);

    if (cards.length === testUsers.length) {
        console.log('✅ Doğru sayıda card oluşturuldu!');

        cards.forEach((card, i) => {
            const name = card.querySelector('.user-name').textContent;
            const avatar = card.querySelector('.user-avatar').textContent;
            console.log(`  Card ${i+1}: "${name}" (Avatar: "${avatar}")`);
        });

        console.log('\n✅ Tüm testler başarılı! 🎉');
    } else {
        console.error(`❌ Card sayısı eşleşmedi! Beklenen: ${testUsers.length}, Bulunan: ${cards.length}`);
    }

    // 6. Boş liste test'i
    console.log('\n Bos Liste Testi...');
    updateActiveUsersList([]);
    const emptyCheck = listEl.innerHTML.includes('çevrimiçi');
    if (emptyCheck) {
        console.log('✅ Boş liste mesajı gösterildi');
    }

    // 7. Socket connection durumu
    console.log('\n🔌 Socket.io Durumu:');
    if (typeof socket !== 'undefined' && socket) {
        console.log(`✅ Socket bulundu - ID: ${socket.id}`);
        console.log(`   Connected: ${socket.connected}`);
        console.log(`   Auth: ${socket.auth ? 'Enabled' : 'None'}`);
    } else {
        console.warn('⚠️  Socket tanımlı değil (Guest modunda olabilir)');
    }

    console.log('\n✨ Test Tamamlandı!');
}

// Test'i çalıştır
testActiveUsers();