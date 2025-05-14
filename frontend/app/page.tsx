import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowRight, Car, Shield, User } from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">Giải pháp quản lý bãi đỗ xe thông minh</h2>
          <p className="text-xl text-muted-foreground mb-8">
            Hệ thống nhận diện biển số xe tự động, giúp quản lý bãi đỗ xe hiệu quả và tiết kiệm thời gian
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/login">
              <Button size="lg" className="gap-2">
                Bắt đầu ngay <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center mb-4">
                <div className="bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Car className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Nhận diện tự động</h3>
                <p className="text-muted-foreground">
                  Nhận diện biển số xe tự động thông qua camera, giúp tiết kiệm thời gian và giảm sai sót
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center mb-4">
                <div className="bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Quản lý dễ dàng</h3>
                <p className="text-muted-foreground">
                  Giao diện thân thiện, dễ sử dụng, giúp quản lý bãi đỗ xe một cách hiệu quả
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center mb-4">
                <div className="bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Bảo mật cao</h3>
                <p className="text-muted-foreground">
                  Hệ thống bảo mật cao, đảm bảo thông tin khách hàng và dữ liệu được bảo vệ an toàn
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="bg-muted rounded-lg p-8">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl font-bold mb-4">Bắt đầu sử dụng ngay hôm nay</h2>
            <p className="text-muted-foreground mb-6">
              Hệ thống nhận diện biển số xe giúp bạn quản lý bãi đỗ xe một cách hiệu quả, tiết kiệm thời gian và chi phí
            </p>
            <Link href="/login">
              <Button size="lg">Đăng nhập</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
